import type { DatabaseSync } from 'node:sqlite';
import type { AppConfig } from '../config/types.ts';
import { recordChange } from '../changes/repository.ts';
import { findCardById, findCardType, updateCard, validateActionFields } from './repository.ts';

export function runCardAction(
  db: DatabaseSync,
  config: AppConfig,
  input: { cardId: string; actionId: string; fields: Record<string, unknown>; actor: string },
) {
  const existing = findCardById(db, input.cardId);
  if (!existing) return { ok: false as const, status: 404 as const };

  const cardType = findCardType(config, existing.type);
  if (!cardType) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { field: 'type', reason: `卡片类型配置不存在：${existing.type}` },
    };
  }

  const actionResult = validateActionFields(cardType, input.actionId, input.fields);
  if (!actionResult.ok) {
    return { ok: false as const, status: 400 as const, error: actionResult.error };
  }

  const card = updateCard(db, existing.id, { fields: actionResult.fields });
  if (!card) return { ok: false as const, status: 404 as const };

  const change = recordChange(db, {
    event: `card.action.${input.actionId}`,
    cardId: card.id,
    action: input.actionId,
    actor: input.actor,
    payload: { fields: actionResult.fields },
  });
  return { ok: true as const, card, change };
}
