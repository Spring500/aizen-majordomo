import type { Context } from 'hono';

export interface ErrorDetails {
  field?: string;
  reason?: string;
  [key: string]: unknown;
}

export function errorBody(code: string, message: string, details?: ErrorDetails) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

export function badRequest(c: Context, code: string, message: string, details?: ErrorDetails) {
  return c.json(errorBody(code, message, details), 400);
}

export function notFound(c: Context, code = 'CARD_NOT_FOUND', message = '卡片不存在') {
  return c.json(errorBody(code, message), 404);
}
