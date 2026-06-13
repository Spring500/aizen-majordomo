import type { Card, CardCoreRow } from './types.ts';

function value<T>(fields: Record<string, unknown>, key: string): T | null {
  return fields[key] === undefined ? null : (fields[key] as T);
}

export function serializeCard(row: CardCoreRow, fields: Record<string, unknown>): Card {
  return {
    ...row,
    fields,
    title: value<string>(fields, 'title'),
    body: value<string>(fields, 'body'),
    options: value<string[]>(fields, 'options'),
    lane: value<string>(fields, 'lane'),
    priority: value<number>(fields, 'priority'),
    assignee: value<string>(fields, 'assignee'),
    reply: value<string>(fields, 'reply'),
    replied_by: value<string>(fields, 'replied_by'),
  };
}
