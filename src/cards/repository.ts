import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { AppConfig, CardTypeConfig, FieldDefinition } from '../config/types.ts';
import { DEFAULT_ACTOR, type Card, type CardCoreRow } from './types.ts';
import { serializeCard } from './serialize.ts';

export interface CreateCardInput {
  type: string;
  status?: string;
  fields: Record<string, unknown>;
  actor?: string;
}

export interface ListCardsInput {
  type?: string;
  status?: string;
  fieldFilters: Array<{ fieldId: string; value: unknown; kind: FieldDefinition['kind'] }>;
  all: boolean;
  limit: number;
  offset: number;
}

export interface UpdateCardInput {
  fields: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  reason: string;
}

function jsonValue(value: unknown) {
  return JSON.stringify(value);
}

function parseValue(value: string): unknown {
  return JSON.parse(value);
}

export function findCardType(config: AppConfig, type: string): CardTypeConfig | null {
  return config.cardTypes.find((item) => item.id === type && item.enabled !== false) ?? null;
}

export function findField(cardType: CardTypeConfig, fieldId: string): FieldDefinition | null {
  return cardType.fields.find((field) => field.id === fieldId) ?? null;
}

export function findAction(cardType: CardTypeConfig, actionId: string) {
  const action = cardType.actions.find((item) => item.id === actionId && item.enabled !== false);
  return action ?? null;
}

export function enabledStatusExists(config: AppConfig, status: string): boolean {
  return config.statuses.some((item) => item.id === status && item.enabled !== false);
}

export function validateFieldValue(field: FieldDefinition, value: unknown): ValidationError | null {
  if (value === null || value === undefined) return null;
  if (field.kind === 'text' || field.kind === 'longText' || field.kind === 'actor') {
    if (typeof value !== 'string') return { field: field.id, reason: `${field.label} 必须是字符串` };
    if (field.required && value.trim().length === 0) return { field: field.id, reason: `${field.label}不能为空` };
    return null;
  }
  if (field.kind === 'number') {
    return typeof value === 'number' && Number.isFinite(value) ? null : { field: field.id, reason: `${field.label} 必须是数字` };
  }
  if (field.kind === 'boolean') {
    return typeof value === 'boolean' ? null : { field: field.id, reason: `${field.label} 必须是 true 或 false` };
  }
  if (field.kind === 'stringList') {
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
      ? null
      : { field: field.id, reason: `${field.label} 必须是字符串数组` };
  }
  if (field.kind === 'enum') {
    return typeof value === 'string' && field.options?.some((item) => item.value === value)
      ? null
      : { field: field.id, reason: `${field.label} 必须是已配置选项` };
  }
  if (field.kind === 'datetime') {
    return typeof value === 'number' || typeof value === 'string'
      ? null
      : { field: field.id, reason: `${field.label} 必须是时间值` };
  }
  return null;
}

export function validateActionFields(
  cardType: CardTypeConfig,
  actionId: string,
  fields: Record<string, unknown>,
): { ok: true; fields: Record<string, unknown> } | { ok: false; error: ValidationError } {
  const action = findAction(cardType, actionId);
  if (!action) return { ok: false, error: { field: 'action', reason: `卡片类型 ${cardType.id} 未启用 ${actionId} 动作` } };

  const allowed = new Set(action.writableFields);
  const next = { ...fields };
  for (const field of cardType.fields) {
    if (next[field.id] === undefined && actionId === 'create' && field.defaultValue !== undefined && allowed.has(field.id)) {
      next[field.id] = field.defaultValue;
    }
  }

  for (const fieldId of Object.keys(next)) {
    const field = findField(cardType, fieldId);
    if (!field) return { ok: false, error: { field: fieldId, reason: `未知字段 ${fieldId}` } };
    if (!allowed.has(fieldId)) return { ok: false, error: { field: fieldId, reason: `${field.label} 不允许在 ${actionId} 中写入` } };
    if (field.readOnly) return { ok: false, error: { field: fieldId, reason: `${field.label} 是只读字段` } };
    const valueError = validateFieldValue(field, next[fieldId]);
    if (valueError) return { ok: false, error: valueError };
  }

  for (const fieldId of action.requiredFields ?? []) {
    const value = next[fieldId];
    if (value === undefined || value === null || value === '') {
      const field = findField(cardType, fieldId);
      return { ok: false, error: { field: fieldId, reason: `${field?.label ?? fieldId}不能为空` } };
    }
  }
  for (const field of cardType.fields) {
    if (!field.required || actionId !== 'create') continue;
    const value = next[field.id];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0)) {
      return { ok: false, error: { field: field.id, reason: `${field.label}不能为空` } };
    }
  }

  return { ok: true, fields: next };
}

function loadFieldValues(db: DatabaseSync, cardIds: string[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const id of cardIds) map.set(id, {});
  if (cardIds.length === 0) return map;
  const placeholders = cardIds.map((_, index) => `@id${index}`).join(', ');
  const params = Object.fromEntries(cardIds.map((id, index) => [`id${index}`, id]));
  const rows = db
    .prepare(`SELECT card_id, field_id, value_json FROM card_field_values WHERE card_id IN (${placeholders})`)
    .all(params as any) as Array<{ card_id: string; field_id: string; value_json: string }>;
  for (const row of rows) {
    map.get(row.card_id)![row.field_id] = parseValue(row.value_json);
  }
  return map;
}

function writeFieldValues(db: DatabaseSync, cardId: string, fields: Record<string, unknown>, updatedAt: number): void {
  const upsert = db.prepare(
    `INSERT INTO card_field_values (card_id, field_id, value_json, updated_at)
     VALUES (@card_id, @field_id, @value_json, @updated_at)
     ON CONFLICT(card_id, field_id) DO UPDATE SET
       value_json = excluded.value_json,
       updated_at = excluded.updated_at`,
  );
  const remove = db.prepare('DELETE FROM card_field_values WHERE card_id = @card_id AND field_id = @field_id');
  for (const [fieldId, value] of Object.entries(fields)) {
    if (value === null || value === undefined) {
      remove.run({ card_id: cardId, field_id: fieldId });
      continue;
    }
    upsert.run({ card_id: cardId, field_id: fieldId, value_json: jsonValue(value), updated_at: updatedAt });
  }
}

export function createCard(db: DatabaseSync, input: CreateCardInput): Card {
  const now = Date.now();
  const id = randomUUID();
  const row = {
    id,
    type: input.type,
    status: input.status ?? 'default',
    created_by: input.actor ?? DEFAULT_ACTOR,
    created_at: now,
    updated_at: now,
  };
  db.prepare(
    `INSERT INTO cards (id, type, status, created_by, created_at, updated_at)
     VALUES (@id, @type, @status, @created_by, @created_at, @updated_at)`,
  ).run(row);
  writeFieldValues(db, id, input.fields, now);
  return serializeCard(row, input.fields);
}

export function listCards(db: DatabaseSync, input: ListCardsInput) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (input.status) {
    clauses.push('cards.status = @status');
    params.status = input.status;
  }
  input.fieldFilters.forEach((filter, index) => {
    const alias = `fv${index}`;
    if (filter.kind === 'stringList') {
      clauses.push(
        `EXISTS (
          SELECT 1 FROM card_field_values ${alias}
          WHERE ${alias}.card_id = cards.id
            AND ${alias}.field_id = @field${index}
            AND EXISTS (
              SELECT 1 FROM json_each(${alias}.value_json) item
              WHERE item.value = @value${index}
            )
        )`,
      );
    } else {
      clauses.push(
        `EXISTS (
          SELECT 1 FROM card_field_values ${alias}
          WHERE ${alias}.card_id = cards.id
            AND ${alias}.field_id = @field${index}
            AND ${alias}.value_json = @value${index}
        )`,
      );
    }
    params[`field${index}`] = filter.fieldId;
    params[`value${index}`] = filter.kind === 'stringList' ? filter.value : jsonValue(filter.value);
  });
  const typeClause = input.type ? 'cards.type = @type' : '';
  const listClauses = typeClause ? [...clauses, typeClause] : clauses;
  const where = listClauses.length ? `WHERE ${listClauses.join(' AND ')}` : '';
  const countParams = input.type ? { ...params, type: input.type } : params;
  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM cards ${where}`).get(countParams as any) as { total: number };
  const pagination = input.all ? '' : 'LIMIT @limit OFFSET @offset';
  const queryParams = input.all ? countParams : { ...countParams, limit: input.limit, offset: input.offset };
  const rows = db
    .prepare(`SELECT * FROM cards ${where} ORDER BY created_at DESC, id DESC ${pagination}`)
    .all(queryParams as any) as unknown as CardCoreRow[];
  const countsWhere = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const countRows = db
    .prepare(`SELECT cards.type AS type, COUNT(*) AS total FROM cards ${countsWhere} GROUP BY cards.type`)
    .all(params as any) as Array<{ type: string; total: number }>;
  const countsByType = Object.fromEntries(countRows.map((row) => [row.type, row.total]));
  const fields = loadFieldValues(
    db,
    rows.map((row) => row.id),
  );
  return { rows: rows.map((row) => serializeCard(row, fields.get(row.id) ?? {})), total: totalRow.total, countsByType };
}

export function findCardById(db: DatabaseSync, id: string): Card | null {
  const row = db.prepare('SELECT * FROM cards WHERE id = @id').get({ id }) as CardCoreRow | undefined;
  if (!row) return null;
  const fields = loadFieldValues(db, [id]).get(id) ?? {};
  return serializeCard(row, fields);
}

export function updateCard(db: DatabaseSync, id: string, input: UpdateCardInput): Card | null {
  const existing = findCardById(db, id);
  if (!existing) return null;
  const now = Date.now();
  writeFieldValues(db, id, input.fields, now);
  db.prepare('UPDATE cards SET updated_at = @updated_at WHERE id = @id').run({ id, updated_at: now });
  return findCardById(db, id);
}

/**
 * 在一次卡片业务操作中更新状态和字段。
 *
 * transition 服务使用该函数保证 `cards.status`、字段值和 `updated_at`
 * 表达同一次状态流转的结果；调用方负责开启事务和完成业务校验。
 */
export function updateCardStateAndFields(
  db: DatabaseSync,
  id: string,
  input: { status: string; fields: Record<string, unknown> },
): Card | null {
  const existing = findCardById(db, id);
  if (!existing) return null;
  const now = Date.now();
  writeFieldValues(db, id, input.fields, now);
  db.prepare('UPDATE cards SET status = @status, updated_at = @updated_at WHERE id = @id').run({
    id,
    status: input.status,
    updated_at: now,
  });
  return findCardById(db, id);
}
