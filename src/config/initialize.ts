import type { DatabaseSync } from 'node:sqlite';
import { SAMPLE_CONFIG } from './sample.ts';
import { readConfig, upsertConfig } from './repository.ts';
import { assertValidConfig } from './validation.ts';

export function initializeConfig(db: DatabaseSync): void {
  assertValidConfig(SAMPLE_CONFIG);
  upsertConfig(db, SAMPLE_CONFIG);
  assertValidConfig(readConfig(db));
}
