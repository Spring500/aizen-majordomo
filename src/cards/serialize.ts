import type { Card, CardRow } from './types.ts';

export function serializeCard(row: CardRow): Card {
  return {
    ...row,
    options: row.options ? (JSON.parse(row.options) as string[]) : null,
  };
}
