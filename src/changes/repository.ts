import type { DatabaseSync } from 'node:sqlite';
import type { ChangeEvent, ChangeRow } from './types.ts';

function parsePayload(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

export function serializeChange(row: ChangeRow): ChangeEvent {
  return {
    seq: row.seq,
    event: row.event,
    cardId: row.card_id,
    action: row.action,
    field: row.field,
    actor: row.actor,
    payload: parsePayload(row.payload_json),
    at: row.at,
  };
}

export function recordChange(
  db: DatabaseSync,
  input: {
    event: string;
    cardId: string;
    action?: string | null;
    field?: string | null;
    actor?: string | null;
    payload?: Record<string, unknown>;
    at?: number;
  },
): ChangeEvent {
  const row = {
    event: input.event,
    card_id: input.cardId,
    action: input.action ?? null,
    field: input.field ?? null,
    actor: input.actor ?? null,
    payload_json: JSON.stringify(input.payload ?? {}),
    at: input.at ?? Date.now(),
  };
  const result = db
    .prepare(
      `INSERT INTO changes (event, card_id, action, field, actor, payload_json, at)
       VALUES (@event, @card_id, @action, @field, @actor, @payload_json, @at)`,
    )
    .run(row);

  return serializeChange({ seq: Number(result.lastInsertRowid), ...row });
}

export function listChangesSince(db: DatabaseSync, since: number): { changes: ChangeEvent[]; latestSeq: number } {
  const rows = db
    .prepare('SELECT * FROM changes WHERE seq > @since ORDER BY seq ASC')
    .all({ since }) as unknown as ChangeRow[];
  const latest = db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM changes').get() as { seq: number };

  return { changes: rows.map(serializeChange), latestSeq: latest.seq };
}
