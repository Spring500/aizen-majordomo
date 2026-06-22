import type { Card, CardFilters, CardType } from '../types.ts';

interface ListCardsResponse {
  cards: Card[];
  total: number;
  countsByType: Record<string, number>;
}

interface CardResponse {
  card: Card;
}

interface ErrorResponse {
  error?: {
    message?: string;
    details?: {
      reason?: string;
    };
  };
}

export async function parseResponse<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & ErrorResponse;
  if (!res.ok) {
    throw new Error(body.error?.details?.reason ?? body.error?.message ?? '请求失败');
  }
  return body;
}

export async function listCards(filters: CardFilters): Promise<ListCardsResponse> {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.status) params.set('status', filters.status);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  for (const [fieldId, value] of Object.entries(filters.fields ?? {})) {
    if (value) params.set(`field.${fieldId}`, value);
  }
  const query = params.toString();
  const res = await fetch(`/cards${query ? `?${query}` : ''}`);
  return parseResponse<ListCardsResponse>(res);
}

export async function createCard(input: {
  type: CardType;
  status?: string;
  fields: Record<string, unknown>;
}): Promise<Card> {
  const res = await fetch('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await parseResponse<CardResponse>(res)).card;
}

export async function getCard(id: string): Promise<Card> {
  const res = await fetch(`/cards/${id}`);
  return (await parseResponse<CardResponse>(res)).card;
}

export async function updateCard(
  id: string,
  input: { fields: Record<string, unknown> },
): Promise<Card> {
  const res = await fetch(`/cards/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await parseResponse<CardResponse>(res)).card;
}

export async function runCardAction(
  id: string,
  actionId: string,
  input: { fields: Record<string, unknown> },
): Promise<Card> {
  const res = await fetch(`/cards/${id}/actions/${actionId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await parseResponse<CardResponse>(res)).card;
}

/**
 * 执行一条卡片状态流转。
 *
 * 调用方必须传入配置中的 transitionId；后端会校验当前状态、卡片类型和可写字段，
 * 成功后返回最新卡片。普通字段保存仍应使用 updateCard。
 */
export async function runCardTransition(
  id: string,
  input: { transitionId: string; fields?: Record<string, unknown>; comment?: string },
): Promise<Card> {
  const res = await fetch(`/cards/${id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, fields: input.fields ?? {} }),
  });
  return (await parseResponse<CardResponse>(res)).card;
}
