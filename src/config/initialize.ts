import type { DatabaseSync } from 'node:sqlite';
import { loadSeedConfig } from './load-seed.ts';
import { readConfig, upsertConfig } from './repository.ts';
import { assertValidConfig } from './validation.ts';

export function initializeConfig(db: DatabaseSync): void {
  const seedConfig = loadSeedConfig();
  assertValidConfig(seedConfig);
  upsertConfig(db, seedConfig);
  assertValidConfig(readConfig(db));
}
