import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { DEFAULT_ACTOR, DEFAULT_STATUS, type CardRow, type CardType } from './types.ts';

export interface CreateCardInput {
  type: CardType;
  title: string;
  body?: string | null;
  options?: string[];
  status?: string;
  lane?: string | null;
  priority?: number;
  assignee?: string | null;
  actor?: string;
}

export interface ListCardsInput {
  type?: string;
  status?: string;
  lane?: string;
  assignee?: string;
  all: boolean;
  limit: number;
  offset: number;
}

export interface UpdateCardInput {
  title?: string;
  body?: string | null;
  priority?: number;
  lane?: string | null;
  assignee?: string | null;
}

function whereClause(input: Pick<ListCardsInput, 'type' | 'status' | 'lane' | 'assignee'>) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (input.type) {
    clauses.push('type = @type');
    params.type = input.type;
  }
  if (input.status) {
    clauses.push('status = @status');
    params.status = input.status;
  }
  if (input.lane) {
    clauses.push('lane = @lane');
    params.lane = input.lane;
  }
  if (input.assignee) {
    clauses.push('assignee = @assignee');
    params.assignee = input.assignee;
  }

  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export function createCard(db: DatabaseSync, input: CreateCardInput): CardRow {
  const now = Date.now();
  const id = randomUUID();
  const row = {
    id,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    options: input.type === 'decision' && input.options ? JSON.stringify(input.options) : null,
    status: input.status ?? DEFAULT_STATUS,
    lane: input.lane ?? null,
    priority: input.priority ?? 0,
    created_by: input.actor ?? DEFAULT_ACTOR,
    assignee: input.assignee ?? null,
    reply: null,
    replied_by: null,
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `INSERT INTO cards (
      id, type, title, body, options, status, lane, priority,
      created_by, assignee, reply, replied_by, created_at, updated_at
    ) VALUES (
      @id, @type, @title, @body, @options, @status, @lane, @priority,
      @created_by, @assignee, @reply, @replied_by, @created_at, @updated_at
    )`,
  ).run(row as any);

  return row;
}

export function listCards(db: DatabaseSync, input: ListCardsInput) {
  const where = whereClause(input);
  const totalRow = db
    .prepare(`SELECT COUNT(*) AS total FROM cards ${where.sql}`)
    .get(where.params as any) as { total: number };

  const pagination = input.all ? '' : 'LIMIT @limit OFFSET @offset';
  const params = input.all ? where.params : { ...where.params, limit: input.limit, offset: input.offset };
  const rows = db
    .prepare(`SELECT * FROM cards ${where.sql} ORDER BY created_at DESC, id DESC ${pagination}`)
    .all(params as any) as unknown as CardRow[];

  return { rows, total: totalRow.total };
}

export function findCardById(db: DatabaseSync, id: string): CardRow | null {
  return (db.prepare('SELECT * FROM cards WHERE id = @id').get({ id }) as CardRow | undefined) ?? null;
}

export function updateCard(db: DatabaseSync, id: string, input: UpdateCardInput): CardRow | null {
  const existing = findCardById(db, id);
  if (!existing) return null;

  const next = {
    id,
    title: input.title ?? existing.title,
    body: input.body !== undefined ? input.body : existing.body,
    priority: input.priority ?? existing.priority,
    lane: input.lane !== undefined ? input.lane : existing.lane,
    assignee: input.assignee !== undefined ? input.assignee : existing.assignee,
    updated_at: Date.now(),
  };

  db.prepare(
    `UPDATE cards
     SET title = @title,
         body = @body,
         priority = @priority,
         lane = @lane,
         assignee = @assignee,
         updated_at = @updated_at
     WHERE id = @id`,
  ).run(next as any);

  return findCardById(db, id);
}
