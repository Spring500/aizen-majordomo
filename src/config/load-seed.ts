import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppConfig } from './types.ts';
import { validateConfig } from './validation.ts';

export const DEFAULT_CONFIG_SEED_PATH = 'scenarios/default-sample/config.json';

export function loadSeedConfig(path = process.env.CONFIG_SEED_PATH ?? DEFAULT_CONFIG_SEED_PATH): AppConfig {
  const resolved = resolve(process.cwd(), path);
  let input: unknown;
  try {
    input = JSON.parse(readFileSync(resolved, 'utf8'));
  } catch (error) {
    throw new Error(`读取配置种子失败：${resolved}`, { cause: error });
  }

  const result = validateConfig(input);
  if (!result.ok) {
    throw new Error(`配置种子无效：${resolved}: ${result.errors.join('; ')}`);
  }

  return input as AppConfig;
}
