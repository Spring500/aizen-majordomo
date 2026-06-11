import type { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../src/app.ts';
import { createDb } from '../../src/db/index.ts';

export function createTestApp() {
  const db = createDb(':memory:');
  const app = createApp(db);
  return { app, db };
}

export async function readJson(res: Response) {
  return (await res.json()) as any;
}

export function insertCard(db: DatabaseSync, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  const card = {
    id: 'card_1',
    type: 'decision',
    title: '推送用 SSE 还是 WebSocket?',
    body: '需拍板',
    options: JSON.stringify(['SSE', 'WebSocket']),
    status: 'default',
    lane: null,
    priority: 0,
    created_by: 'agent',
    assignee: null,
    reply: null,
    replied_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };

  db.prepare(
    `INSERT INTO cards (
      id, type, title, body, options, status, lane, priority,
      created_by, assignee, reply, replied_by, created_at, updated_at
    ) VALUES (
      @id, @type, @title, @body, @options, @status, @lane, @priority,
      @created_by, @assignee, @reply, @replied_by, @created_at, @updated_at
    )`,
  ).run(card as any);

  return card;
}
