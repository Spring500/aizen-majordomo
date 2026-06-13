import type { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
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
    id: String(overrides.id ?? 'card_1'),
    type: String(overrides.type ?? 'decision'),
    status: String(overrides.status ?? 'default'),
    created_by: String(overrides.created_by ?? 'agent'),
    created_at: Number(overrides.created_at ?? now),
    updated_at: Number(overrides.updated_at ?? now),
  };
  const fields = {
    title: overrides.title ?? '推送用 SSE 还是 WebSocket?',
    body: overrides.body ?? '需拍板',
    options: overrides.options ? JSON.parse(String(overrides.options)) : ['SSE', 'WebSocket'],
    lane: overrides.lane,
    priority: overrides.priority ?? 0,
    assignee: overrides.assignee,
    reply: overrides.reply,
    replied_by: overrides.replied_by,
  };

  db.prepare(
    `INSERT INTO cards (id, type, status, created_by, created_at, updated_at)
     VALUES (@id, @type, @status, @created_by, @created_at, @updated_at)`,
  ).run(card as any);
  const insertField = db.prepare(
    `INSERT INTO card_field_values (card_id, field_id, value_json, updated_at)
     VALUES (@card_id, @field_id, @value_json, @updated_at)`,
  );
  for (const [fieldId, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    insertField.run({
      card_id: card.id,
      field_id: fieldId,
      value_json: JSON.stringify(value),
      updated_at: card.updated_at,
    } as Record<string, SQLInputValue>);
  }

  return card;
}
