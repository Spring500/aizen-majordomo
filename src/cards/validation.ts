import { DEFAULT_LIMIT, FLAT_FIELD_IDS, MAX_LIMIT } from './types.ts';

export interface NormalizedCreateBody {
  type?: string;
  status?: string;
  fields: Record<string, unknown>;
}

export interface NormalizedUpdateBody {
  statusPresent: boolean;
  fields: Record<string, unknown>;
}

export function parsePagination(url: URL) {
  const all = url.searchParams.get('all') === 'true';
  const rawLimit = url.searchParams.get('limit');
  const rawOffset = url.searchParams.get('offset');

  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return {
      ok: false as const,
      error: { field: 'limit', reason: `limit 必须是 1 到 ${MAX_LIMIT} 之间的整数` },
    };
  }

  if (!Number.isInteger(offset) || offset < 0) {
    return {
      ok: false as const,
      error: { field: 'offset', reason: 'offset 必须是大于或等于 0 的整数' },
    };
  }

  return { ok: true as const, value: { all, limit, offset } };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectFields(body: Record<string, unknown>, fieldsValue: unknown) {
  if (fieldsValue !== undefined && !isObject(fieldsValue)) {
    return { ok: false as const, error: { field: 'fields', reason: 'fields 必须是对象' } };
  }

  const fields = fieldsValue ? { ...(fieldsValue as Record<string, unknown>) } : {};
  for (const fieldId of FLAT_FIELD_IDS) {
    if (!(fieldId in body)) continue;
    if (fieldId in fields) {
      return { ok: false as const, error: { field: fieldId, reason: `${fieldId} 不能同时出现在 fields 和扁平字段中` } };
    }
    fields[fieldId] = body[fieldId];
  }
  return { ok: true as const, fields };
}

export function normalizeCreateBody(input: unknown) {
  if (!isObject(input)) {
    return { ok: false as const, error: { field: 'body', reason: '请求体必须是对象' } };
  }
  const collected = collectFields(input, input.fields);
  if (!collected.ok) return collected;
  return {
    ok: true as const,
    value: {
      type: typeof input.type === 'string' ? input.type : undefined,
      status: typeof input.status === 'string' ? input.status : undefined,
      fields: collected.fields,
    } satisfies NormalizedCreateBody,
  };
}

export function normalizeUpdateBody(input: unknown) {
  if (!isObject(input)) {
    return { ok: false as const, error: { field: 'body', reason: '请求体必须是对象' } };
  }
  const collected = collectFields(input, input.fields);
  if (!collected.ok) return collected;
  return {
    ok: true as const,
    value: {
      statusPresent: Object.hasOwn(input, 'status'),
      fields: collected.fields,
    } satisfies NormalizedUpdateBody,
  };
}

export function fieldFilterEntries(url: URL) {
  const entries: Array<{ fieldId: string; rawValue: string }> = [];
  for (const [key, value] of url.searchParams.entries()) {
    if (!key.startsWith('field.')) continue;
    entries.push({ fieldId: key.slice('field.'.length), rawValue: value });
  }
  return entries;
}
