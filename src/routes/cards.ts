import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';

export const cards = new Hono<AppEnv>();

interface CardRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  options: string | null;
  status: string;
  lane: string | null;
  priority: number;
  created_by: string;
  assignee: string | null;
  reply: string | null;
  replied_by: string | null;
  created_at: number;
  updated_at: number;
}

function serialize(row: CardRow) {
  return {
    ...row,
    options: row.options ? JSON.parse(row.options) : null,
  };
}

// GET /cards — 示例只读端点 (spec 7.3.2)。鉴权/过滤分页留待后续实现。
cards.get('/', (c) => {
  const db = c.get('db');
  const rows = db
    .prepare('SELECT * FROM cards ORDER BY created_at DESC LIMIT 50')
    .all() as unknown as CardRow[];
  return c.json({ cards: rows.map(serialize), total: rows.length });
});
