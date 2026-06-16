import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { createDb, migrate } from '../src/db/index.ts';
import { loadSeedConfig } from '../src/config/load-seed.ts';
import { upsertConfig } from '../src/config/repository.ts';

export const SCENARIOS_DIR = resolve(process.cwd(), 'scenarios');
export const SCENARIO_DB_DIR = resolve(
  process.cwd(),
  process.env.SCENARIO_DB_DIR ??
    (process.env.VITEST_POOL_ID ? join('data', 'scenarios', `vitest-${process.env.VITEST_POOL_ID}`) : join('data', 'scenarios')),
);
const SCENARIO_ORDER = [
  'default-sample',
  'custom-review-flow',
  'status-matrix',
  'existing-data-config-change',
  'legacy-stage1-migration',
  'large-dataset-smoke',
];

interface SeedRef {
  type: 'ts' | 'sql';
  path: string;
}

interface ScenarioPhase {
  name: string;
  config?: string;
  seed?: SeedRef;
}

export interface ScenarioManifest {
  id: string;
  name: string;
  description: string;
  config?: string;
  seed?: SeedRef;
  phases?: ScenarioPhase[];
  readme?: string;
  tags?: string[];
  expected?: Record<string, unknown>;
}

export interface PreparedScenario {
  manifest: ScenarioManifest;
  preparedDb: string;
}

export function preparedDbPath(id: string): string {
  return join(SCENARIO_DB_DIR, `${id}.prepared.db`);
}

export function runtimeDbPath(id: string, qualifier?: string): string {
  return join(SCENARIO_DB_DIR, qualifier ? `${id}.${qualifier}.runtime.db` : `${id}.runtime.db`);
}

function scenarioDir(id: string): string {
  return join(SCENARIOS_DIR, id);
}

function removeSqliteFiles(path: string): void {
  for (const file of [path, `${path}-wal`, `${path}-shm`]) {
    rmSync(file, { force: true });
  }
}

function readManifest(id: string): ScenarioManifest {
  const path = join(scenarioDir(id), 'scenario.json');
  return JSON.parse(readFileSync(path, 'utf8')) as ScenarioManifest;
}

export function finalScenarioConfigPath(id: string): string | undefined {
  const manifest = readManifest(id);
  const config = manifest.phases?.at(-1)?.config ?? manifest.config;
  return config ? join(scenarioDir(id), config) : undefined;
}

export function listScenarios(): ScenarioManifest[] {
  return readdirSync(SCENARIOS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readManifest(entry.name))
    .sort((a, b) => {
      const left = SCENARIO_ORDER.indexOf(a.id);
      const right = SCENARIO_ORDER.indexOf(b.id);
      if (left !== -1 && right !== -1) return left - right;
      if (left !== -1) return -1;
      if (right !== -1) return 1;
      return a.id.localeCompare(b.id);
    });
}

async function runSeed(db: DatabaseSync, baseDir: string, seed?: SeedRef): Promise<void> {
  if (!seed) return;
  const seedPath = join(baseDir, seed.path);
  if (seed.type === 'sql') {
    db.exec(readFileSync(seedPath, 'utf8'));
    return;
  }
  const module = (await import(`${pathToFileURL(seedPath).href}?t=${Date.now()}`)) as {
    seed?: (db: DatabaseSync) => void | Promise<void>;
  };
  if (typeof module.seed !== 'function') throw new Error(`场景 seed 缺少 seed(db) 导出：${seedPath}`);
  await module.seed(db);
}

function withConfigSeed<T>(configPath: string | undefined, run: () => T): T {
  const previous = process.env.CONFIG_SEED_PATH;
  if (configPath) process.env.CONFIG_SEED_PATH = configPath;
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.CONFIG_SEED_PATH;
    } else {
      process.env.CONFIG_SEED_PATH = previous;
    }
  }
}

function applyConfig(db: DatabaseSync, path: string): void {
  upsertConfig(db, loadSeedConfig(path));
}

export async function prepareScenario(id: string): Promise<PreparedScenario> {
  const manifest = readManifest(id);
  const baseDir = scenarioDir(id);
  const preparedDb = preparedDbPath(id);
  mkdirSync(dirname(preparedDb), { recursive: true });
  removeSqliteFiles(preparedDb);

  let db: DatabaseSync;
  if (manifest.seed?.type === 'sql' && !manifest.config && !manifest.phases) {
    db = new DatabaseSync(preparedDb);
    db.exec(readFileSync(join(baseDir, manifest.seed.path), 'utf8'));
    migrate(db);
  } else if (manifest.phases?.length) {
    const firstConfig = manifest.phases[0]?.config;
    db = withConfigSeed(firstConfig ? join(baseDir, firstConfig) : undefined, () => createDb(preparedDb));
    for (const phase of manifest.phases) {
      if (phase.name !== manifest.phases[0]?.name && phase.config) applyConfig(db, join(baseDir, phase.config));
      await runSeed(db, baseDir, phase.seed);
    }
  } else {
    db = withConfigSeed(manifest.config ? join(baseDir, manifest.config) : undefined, () => createDb(preparedDb));
    await runSeed(db, baseDir, manifest.seed);
  }

  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  db.close();
  return { manifest, preparedDb };
}

export async function copyScenarioDb(id: string, target: string): Promise<string> {
  const source = preparedDbPath(id);
  if (!existsSync(source)) await prepareScenario(id);
  mkdirSync(dirname(resolve(target)), { recursive: true });
  removeSqliteFiles(target);
  copyFileSync(source, target);
  return target;
}

export async function prepareScenarioRuntime(id: string, fresh = false, qualifier?: string): Promise<string> {
  const prepared = preparedDbPath(id);
  if (fresh || !existsSync(prepared)) await prepareScenario(id);
  const runtime = runtimeDbPath(id, qualifier);
  await copyScenarioDb(id, runtime);
  return runtime;
}
