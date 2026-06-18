import { existsSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { prepareScenarioRuntime, startScenarioServer } from '../helpers/scenario.ts';
import { readConfig } from '../../src/config/repository.ts';

describe('阶段 2 E2E 场景 helper', () => {
  it('能为任意场景复制隔离 runtime db', async () => {
    const runtime = await prepareScenarioRuntime('custom-review-flow');
    const db = new DatabaseSync(runtime.dbPath);
    const config = readConfig(db);
    db.close();

    expect(existsSync(runtime.dbPath), 'E2E helper 应生成隔离 runtime db。若失败：检查 copyScenarioDb 调用').toBe(true);
    expect(
      runtime.dbPath.includes('.tmp\\test-runs') || runtime.dbPath.includes('.tmp/test-runs'),
      'E2E helper 应使用按测试运行隔离的目录。若失败：检查 runtime db 是否仍落在固定 .tmp/e2e 或 data/scenarios',
    ).toBe(true);
    expect(
      config.cardTypes.map((item) => item.id),
      'E2E runtime db 应使用指定场景配置。若失败：检查场景 helper 是否硬编码默认配置',
    ).toEqual(['review']);
  });

  it('能基于 runtime db 启动可关闭的场景服务', async () => {
    const runtime = await prepareScenarioRuntime('status-matrix');
    const server = await startScenarioServer(runtime, { port: 0 });

    const res = await fetch(`${server.url}/config`);
    const body = (await res.json()) as { statuses: Array<{ id: string }> };
    await server.close();

    expect(res.status, '场景服务应能响应 /config。若失败：检查 startScenarioServer 是否正确装配 Hono').toBe(200);
    expect(
      body.statuses.map((item) => item.id),
      '场景服务应读取 runtime db 中的 status-matrix 配置。若失败：检查 DB_PATH/数据库注入',
    ).toEqual(['triage', 'doing', 'blocked', 'done']);
  });
});
