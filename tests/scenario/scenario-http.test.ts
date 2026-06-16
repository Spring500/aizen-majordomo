import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareScenarioRuntime, startScenarioServer } from '../helpers/scenario.ts';

afterEach(() => {
  rmSync(`.tmp/e2e/vitest-${process.env.VITEST_POOL_ID ?? 'local'}`, { recursive: true, force: true });
});

async function withScenario<T>(id: string, run: (url: string) => Promise<T>): Promise<T> {
  const runtime = await prepareScenarioRuntime(id);
  const server = await startScenarioServer(runtime, { port: 0 });
  try {
    return await run(server.url);
  } finally {
    await server.close();
  }
}

async function json(res: Response): Promise<any> {
  return res.json();
}

describe('阶段 2 场景化配置 HTTP 证明点', () => {
  it('default-sample 支持默认类型、active 状态和 risk_level 字段过滤', async () => {
    await withScenario('default-sample', async (url) => {
      const created = await fetch(`${url}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'task', status: 'active', fields: { title: '默认场景高风险', risk_level: 'high' } }),
      });
      const filtered = await fetch(`${url}/cards?field.risk_level=high`);
      const body = await json(filtered);

      expect(created.status, 'default-sample 应允许创建 active task。若失败：检查默认场景状态和 create action').toBe(201);
      expect(body.total, 'default-sample 应支持 risk_level 字段过滤。若失败：检查字段过滤和默认配置').toBe(1);
    });
  });

  it('custom-review-flow 使用完全独立字段并支持 audit_domain 过滤', async () => {
    await withScenario('custom-review-flow', async (url) => {
      const configRes = await fetch(`${url}/config`);
      const config = await json(configRes);
      const rejected = await fetch(`${url}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'task', fields: { title: '不应成功' } }),
      });
      const filtered = await fetch(`${url}/cards?field.audit_domain=privacy`);
      const body = await json(filtered);
      const fieldIds = config.cardTypes.flatMap((type: any) => type.fields.map((field: any) => field.id));

      expect(
        fieldIds,
        'custom-review-flow 应使用完全独立字段。若失败：检查是否仍保留默认或其它场景字段',
      ).toEqual(['case_subject', 'audit_domain', 'evidence_url', 'needs_followup']);
      expect(rejected.status, 'custom-review-flow 应拒绝写死的 task 类型。若失败：检查卡片类型校验').toBe(400);
      expect(body.total, 'custom-review-flow 应能按 audit_domain 过滤 seed 卡。若失败：检查自定义 enum 字段过滤').toBe(1);
    });
  });

  it('status-matrix 拒绝未知状态并能读取 blocked 状态卡', async () => {
    await withScenario('status-matrix', async (url) => {
      const rejected = await fetch(`${url}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'task', status: 'waiting', fields: { title: '未知状态' } }),
      });
      const blocked = await fetch(`${url}/cards?status=blocked`);
      const body = await json(blocked);

      expect(rejected.status, 'status-matrix 应拒绝配置之外的 waiting 状态。若失败：检查状态校验').toBe(400);
      expect(body.total, 'status-matrix 应能筛选 blocked 状态卡。若失败：检查 status 参数过滤').toBe(1);
    });
  });

  it('existing-data-config-change 保留历史字段并只允许 after 配置字段写入', async () => {
    await withScenario('existing-data-config-change', async (url) => {
      const list = await fetch(`${url}/cards?all=true`);
      const card = (await json(list)).cards[0];
      const legacyPatch = await fetch(`${url}/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { legacy_note: '不应允许' } }),
      });
      const impactPatch = await fetch(`${url}/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { impact: 'global' } }),
      });

      expect(card.fields.legacy_note, '配置变化后旧卡 fields 应保留 legacy_note。若失败：检查字段值表读取').toBe(
        '这段旧备注应在配置变化后保留',
      );
      expect(legacyPatch.status, 'after 配置不应允许继续写 legacy_note。若失败：检查 update action 覆盖').toBe(400);
      expect(impactPatch.status, 'after 配置应允许写新增 impact 字段。若失败：检查 after 配置写入').toBe(200);
    });
  });

  it('legacy-stage1-migration 同时返回扁平字段和 fields', async () => {
    await withScenario('legacy-stage1-migration', async (url) => {
      const list = await fetch(`${url}/cards?all=true`);
      const body = await json(list);
      const task = body.cards.find((card: any) => card.id === 'legacy-task-1');

      expect(task.title, '旧库迁移后应保留阶段 1 扁平 title。若失败：检查 serializeCard 兼容字段').toBe('旧任务标题');
      expect(task.fields.title, '旧库迁移后 fields.title 应可读。若失败：检查 card_field_values 迁移').toBe('旧任务标题');
    });
  });

  it('large-dataset-smoke 保持默认分页和字段过滤正确', async () => {
    await withScenario('large-dataset-smoke', async (url) => {
      const firstPage = await fetch(`${url}/cards`);
      const high = await fetch(`${url}/cards?field.risk_level=high`);
      const firstPageBody = await json(firstPage);
      const highBody = await json(high);

      expect(firstPageBody.cards.length, '大量数据场景默认分页应返回 50 张。若失败：检查分页默认值').toBe(50);
      expect(firstPageBody.total, '大量数据场景总数应为 1000。若失败：检查 seed 规模或 total 查询').toBe(1000);
      expect(highBody.total > 0, '大量数据场景应能过滤 high 风险卡。若失败：检查字段过滤').toBe(true);
    });
  }, 20_000);
});
