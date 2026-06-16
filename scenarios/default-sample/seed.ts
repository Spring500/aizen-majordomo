import type { DatabaseSync } from 'node:sqlite';

export async function seed(_db: DatabaseSync): Promise<void> {
  // 默认样例场景保持空库，用于验证从零开始的配置驱动路径。
}
