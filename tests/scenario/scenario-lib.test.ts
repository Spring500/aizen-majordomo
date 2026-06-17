import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  copyScenarioDb,
  listScenarios,
  preparedDbPath,
  prepareScenario,
  runtimeDbPath,
  SCENARIO_DB_DIR,
} from '../../scripts/scenario-lib.ts';
import { readConfig } from '../../src/config/repository.ts';

const generated = SCENARIO_DB_DIR;
const tmpRoot = join(tmpdir(), 'aizen-scenario-tests');

afterEach(() => {
  rmSync(generated, { recursive: true, force: true });
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('阶段 2 场景数据库工具', () => {
  it('能列出阶段 2 要求的 6 个场景', () => {
    const ids = listScenarios().map((scenario) => scenario.id);

    expect(
      ids.slice(0, 6),
      '场景列表前 6 项应保持阶段 2 场景顺序。若失败：检查 scenarios 目录或排序逻辑',
    ).toEqual([
      'default-sample',
      'custom-review-flow',
      'status-matrix',
      'existing-data-config-change',
      'legacy-stage1-migration',
      'large-dataset-smoke',
    ]);
  });

  it('能列出 agent kit 的实战看板配置场景', () => {
    const ids = listScenarios().map((scenario) => scenario.id);

    expect(ids, 'agent-board-config 应作为 agent-kit 配置场景出现在列表中').toContain('agent-board-config');
  });

  it('prepare 会生成 default-sample 基准数据库并写入场景配置', async () => {
    const result = await prepareScenario('default-sample');
    const db = new DatabaseSync(result.preparedDb);
    const config = readConfig(db);
    db.close();

    expect(result.preparedDb, 'prepare 应返回 prepared db 路径。若失败：检查 prepareScenario 返回值').toBe(
      preparedDbPath('default-sample'),
    );
    expect(existsSync(result.preparedDb), 'prepare 应生成 prepared db 文件。若失败：检查数据库创建路径').toBe(true);
    expect(
      config.cardTypes.map((item) => item.id),
      'prepared db 应写入 default-sample 配置。若失败：检查 CONFIG_SEED_PATH 注入或初始化流程',
    ).toEqual(['task', 'decision', 'memo']);
  });

  it('copy-db 会从 prepared db 复制稳定数据库并清理目标 WAL 文件', async () => {
    mkdirSync(tmpRoot, { recursive: true });
    const target = join(tmpRoot, 'copy.db');
    writeFileSync(`${target}-wal`, 'stale', 'utf8');
    writeFileSync(`${target}-shm`, 'stale', 'utf8');

    await copyScenarioDb('custom-review-flow', target);
    const db = new DatabaseSync(target);
    const config = readConfig(db);
    db.close();

    expect(existsSync(target), 'copy-db 应生成目标主 db 文件。若失败：检查复制流程').toBe(true);
    expect(existsSync(`${target}-wal`), 'copy-db 应删除目标旧 WAL 文件。若失败：检查复制前清理逻辑').toBe(false);
    expect(existsSync(`${target}-shm`), 'copy-db 应删除目标旧 SHM 文件。若失败：检查复制前清理逻辑').toBe(false);
    expect(
      config.cardTypes.map((item) => item.id),
      '复制出的 custom-review-flow 数据库应只包含 review 类型。若失败：检查场景配置是否写入 prepared db',
    ).toEqual(['review']);
  });

  it('runtime db 路径可按端口隔离以支持多端口并行启动', () => {
    expect(
      runtimeDbPath('status-matrix', 'port3137'),
      '带端口启动应使用隔离 runtime db。若失败：检查 scenario:start 多端口并行能力',
    ).toContain('status-matrix.port3137.runtime.db');
  });

  it('existing-data-config-change 会先造旧数据再覆盖为 after 配置', async () => {
    const result = await prepareScenario('existing-data-config-change');
    const db = new DatabaseSync(result.preparedDb);
    const config = readConfig(db);
    const legacyNote = db
      .prepare("SELECT value_json FROM card_field_values WHERE field_id = 'legacy_note'")
      .get() as { value_json: string } | undefined;
    db.close();
    const task = config.cardTypes.find((item) => item.id === 'task');

    expect(legacyNote, '历史 legacy_note 字段值应保留在字段值表。若失败：检查 before 阶段 seed').toBeTruthy();
    expect(
      task?.fields.some((field) => field.id === 'impact'),
      'after 配置应新增 impact 字段。若失败：检查 config.after.json 覆盖流程',
    ).toBe(true);
    expect(
      task?.actions.find((action) => action.id === 'update')?.writableFields.includes('legacy_note'),
      'after 配置不应允许继续写 legacy_note。若失败：检查配置变化是否真正覆盖到数据库',
    ).toBe(false);
  });

  it('legacy-stage1-migration 会把旧 cards 表迁移为字段值表', async () => {
    const result = await prepareScenario('legacy-stage1-migration');
    const db = new DatabaseSync(result.preparedDb);
    const migratedTitle = db
      .prepare("SELECT value_json FROM card_field_values WHERE card_id = 'legacy-task-1' AND field_id = 'title'")
      .get() as { value_json: string } | undefined;
    const legacyTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cards_legacy_stage2'")
      .get() as { name: string } | undefined;
    db.close();

    expect(legacyTable?.name, '迁移后应保留 cards_legacy_stage2。若失败：检查旧库迁移流程').toBe(
      'cards_legacy_stage2',
    );
    expect(
      migratedTitle ? JSON.parse(migratedTitle.value_json) : undefined,
      '旧 cards.title 应迁入 card_field_values。若失败：检查 migrateCardsTable 字段迁移列表',
    ).toBe('旧任务标题');
  });

  it('large-dataset-smoke 会准备 1000 张卡片', async () => {
    const result = await prepareScenario('large-dataset-smoke');
    const db = new DatabaseSync(result.preparedDb);
    const row = db.prepare('SELECT COUNT(*) AS count FROM cards').get() as { count: number };
    const high = db
      .prepare("SELECT COUNT(*) AS count FROM card_field_values WHERE field_id = 'risk_level' AND value_json = '\"high\"'")
      .get() as { count: number };
    db.close();

    expect(row.count, 'large-dataset-smoke 应生成 1000 张卡。若失败：检查 seed 规模').toBe(1000);
    expect(high.count > 0, '大量数据场景应包含 high 风险卡。若失败：检查 risk_level 分布').toBe(true);
  }, 20_000);
});
