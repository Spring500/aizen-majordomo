import type { Card, CardCoreRow } from './types.ts';

export function serializeCard(row: CardCoreRow, fields: Record<string, unknown>): Card {
  return {
    ...row,
    fields,
  };
}
