import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';
import { recordChange } from '../changes/repository.ts';
import { readConfig } from '../config/repository.ts';
import { runCardAction } from '../cards/actions.ts';
import {
  createCard,
  enabledStatusExists,
  findCardById,
  findCardType,
  findField,
  listCards,
  updateCard,
  validateFieldValue,
  validateActionFields,
} from '../cards/repository.ts';
import { fieldFilterEntries, normalizeCreateBody, normalizeUpdateBody, parsePagination } from '../cards/validation.ts';
import { DEFAULT_STATUS } from '../cards/types.ts';
import { badRequest, notFound } from '../http/errors.ts';

export const cards = new Hono<AppEnv>();

function parseFieldFilterValue(field: NonNullable<ReturnType<typeof findField>>, rawValue: string) {
  if (field.kind === 'text' || field.kind === 'actor' || field.kind === 'enum') return rawValue;
  if (field.kind === 'number') {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : undefined;
  }
  if (field.kind === 'boolean') {
    if (rawValue === 'true') return true;
    if (rawValue === 'false') return false;
    return undefined;
  }
  if (field.kind === 'stringList') return rawValue;
  return undefined;
}

cards.get('/', (c) => {
  const pagination = parsePagination(new URL(c.req.url));
  if (!pagination.ok) return badRequest(c, 'VALIDATION_ERROR', '查询参数无效', pagination.error);

  const config = readConfig(c.get('db'));
  const url = new URL(c.req.url);
  const rawFieldFilters = fieldFilterEntries(url);
  if (c.req.query('lane')) rawFieldFilters.push({ fieldId: 'lane', rawValue: c.req.query('lane')! });
  if (c.req.query('assignee')) rawFieldFilters.push({ fieldId: 'assignee', rawValue: c.req.query('assignee')! });

  const fieldFilters = [];
  for (const filter of rawFieldFilters) {
    const field = config.cardTypes.flatMap((type) => type.fields).find((item) => item.id === filter.fieldId);
    if (!field) {
      return badRequest(c, 'VALIDATION_ERROR', '查询参数无效', { field: filter.fieldId, reason: '未知字段' });
    }
    if (!['text', 'actor', 'number', 'boolean', 'enum', 'stringList'].includes(field.kind)) {
      return badRequest(c, 'VALIDATION_ERROR', '查询参数无效', { field: filter.fieldId, reason: '该字段类型不支持过滤' });
    }
    const value = parseFieldFilterValue(field, filter.rawValue);
    if (value === undefined || (field.kind !== 'stringList' && validateFieldValue(field, value))) {
      return badRequest(c, 'VALIDATION_ERROR', '查询参数无效', { field: filter.fieldId, reason: '字段过滤值无效' });
    }
    fieldFilters.push({ fieldId: filter.fieldId, value, kind: field.kind });
  }

  const result = listCards(c.get('db'), {
    type: c.req.query('type'),
    status: c.req.query('status'),
    fieldFilters,
    ...pagination.value,
  });

  return c.json({ cards: result.rows, total: result.total, countsByType: result.countsByType });
});

cards.post('/', async (c) => {
  const parsed = normalizeCreateBody(await c.req.json().catch(() => undefined));
  if (!parsed.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', parsed.error);

  const config = readConfig(c.get('db'));
  if (!parsed.value.type) {
    return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', { field: 'type', reason: 'type 不能为空' });
  }
  const cardType = findCardType(config, parsed.value.type);
  if (!cardType) {
    return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', { field: 'type', reason: '未知卡片类型' });
  }
  const status = parsed.value.status ?? DEFAULT_STATUS;
  if (!enabledStatusExists(config, status)) {
    return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', { field: 'status', reason: '未知状态' });
  }
  if (!findField(cardType, 'options') && Object.hasOwn(parsed.value.fields, 'options')) {
    delete parsed.value.fields.options;
  }
  const actionResult = validateActionFields(cardType, 'create', parsed.value.fields);
  if (!actionResult.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', { ...actionResult.error });

  const row = createCard(c.get('db'), {
    type: cardType.id,
    status,
    fields: actionResult.fields,
    actor: c.req.header('X-Actor') ?? undefined,
  });
  const change = recordChange(c.get('db'), {
    event: 'card.created',
    cardId: row.id,
    actor: c.req.header('X-Actor') ?? 'human',
    payload: {
      type: row.type,
      status: row.status,
      fields: row.fields,
    },
  });
  return c.json({ card: row, change }, 201);
});

cards.get('/:id', (c) => {
  const row = findCardById(c.get('db'), c.req.param('id'));
  if (!row) return notFound(c);

  return c.json({ card: row });
});

cards.post('/:id/actions/:actionId', async (c) => {
  const parsed = normalizeUpdateBody(await c.req.json().catch(() => undefined));
  if (!parsed.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', parsed.error);
  if (parsed.value.statusPresent) {
    return badRequest(c, 'STATUS_PATCH_FORBIDDEN', '不允许通过 action 修改 status', {
      field: 'status',
      reason: '请使用 transition 接口修改状态',
    });
  }

  const config = readConfig(c.get('db'));
  const result = runCardAction(c.get('db'), config, {
    cardId: c.req.param('id'),
    actionId: c.req.param('actionId'),
    fields: parsed.value.fields,
    actor: c.req.header('X-Actor') ?? 'human',
  });

  if (!result.ok && result.status === 404) return notFound(c);
  if (!result.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', result.error);

  return c.json({ card: result.card, change: result.change });
});

cards.patch('/:id', async (c) => {
  const parsed = normalizeUpdateBody(await c.req.json().catch(() => undefined));
  if (!parsed.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', parsed.error);
  if (parsed.value.statusPresent) {
    return badRequest(c, 'STATUS_PATCH_FORBIDDEN', '不允许通过 PATCH 修改 status', {
      field: 'status',
      reason: '请使用 transition 接口修改状态',
    });
  }

  const existing = findCardById(c.get('db'), c.req.param('id'));
  if (!existing) return notFound(c);
  const config = readConfig(c.get('db'));
  const cardType = findCardType(config, existing.type);
  if (!cardType) return badRequest(c, 'CONFIG_ERROR', '卡片类型配置不存在', { field: 'type', reason: existing.type });
  const actionResult = validateActionFields(cardType, 'update', parsed.value.fields);
  if (!actionResult.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', { ...actionResult.error });

  const row = updateCard(c.get('db'), existing.id, { fields: actionResult.fields });
  if (!row) return notFound(c);

  const change = recordChange(c.get('db'), {
    event: 'card.updated',
    cardId: row.id,
    actor: c.req.header('X-Actor') ?? 'human',
    payload: { fields: actionResult.fields },
  });

  return c.json({ card: row, change });
});
