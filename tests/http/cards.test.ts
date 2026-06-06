import { describe, it, expect } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { createDb } from '../../src/db/index.ts';
import { createApp } from '../../src/app.ts';

function insertCard(db: DatabaseSync, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  const card = {
    id: 'card_1',
    type: 'decision',
    title: '推送用 SSE 还是 WebSocket?',
    body: '需拍板',
    options: JSON.stringify(['SSE', 'WebSocket']),
    status: 'todo',
    created_by: 'agent',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
  db.prepare(
    `INSERT INTO cards (id, type, title, body, options, status, created_by, created_at, updated_at)
     VALUES (@id, @type, @title, @body, @options, @status, @created_by, @created_at, @updated_at)`,
  ).run(card as any);
}

// 行为:列卡端点 (spec 7.3.2)。当前为只读，鉴权/过滤分页后续实现。
describe('GET /cards 列卡', () => {
  it('给定空看板，当请求列卡时，返回空数组且 total 为 0', async () => {
    // 假如:一块没有任何卡片的看板
    const app = createApp(createDb(':memory:'));

    // 当:请求 /cards
    const res = await app.request('/cards');

    // 那么:返回 200 与空结果
    expect(
      res.status,
      'GET /cards 应返回 200。若失败：检查 cards 路由是否挂载，以及 db 是否经 context 注入(c.get("db"))',
    ).toBe(200);
    expect(
      await res.json(),
      '空看板应返回 {cards:[],total:0}。若失败：检查空库查询路径或 serialize() 是否对空结果出错',
    ).toEqual({ cards: [], total: 0 });
  });

  it('给定库中已有一张决策卡，当请求列卡时，返回该卡且 options 被解析为数组', async () => {
    // 假如:库中已存在一张带 options 的决策卡
    const db = createDb(':memory:');
    insertCard(db);
    const app = createApp(db);

    // 当:请求 /cards
    const res = await app.request('/cards');

    // 那么:返回该卡，total 为 1，且 options 由 JSON 字符串解析回数组
    const body: any = await res.json();
    expect(
      body.total,
      '应恰好返回 1 张卡。若 total≠1：检查 insertCard 是否插入成功，或查询 LIMIT/过滤是否漏读多读',
    ).toBe(1);
    expect(
      body.cards[0].id,
      '返回卡片的 id 应为 card_1。若失败：检查 SELECT * 的字段映射是否与表结构一致',
    ).toBe('card_1');
    expect(
      body.cards[0].options,
      'options 应由 JSON 字符串解析回数组 ["SSE","WebSocket"]。若仍是字符串：检查 serialize() 里的 JSON.parse 是否生效',
    ).toEqual(['SSE', 'WebSocket']);
  });
});
