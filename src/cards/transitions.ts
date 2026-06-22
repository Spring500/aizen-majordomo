import type { DatabaseSync } from 'node:sqlite';
import { recordChange } from '../changes/repository.ts';
import type { ChangeEvent } from '../changes/types.ts';
import { createComment } from '../comments/repository.ts';
import type { Comment } from '../comments/types.ts';
import type { AppConfig, CardTypeConfig, TransitionConfig } from '../config/types.ts';
import {
  enabledStatusExists,
  findCardById,
  findCardType,
  findField,
  updateCardStateAndFields,
  validateFieldValue,
  type ValidationError,
} from './repository.ts';
import type { Card } from './types.ts';

/** 执行 transition 的输入；HTTP route 和未来 hook 都应使用这个结构。 */
export interface RunCardTransitionInput {
  /** 要流转的卡片 id。 */
  cardId: string;
  /** 要执行的 transition id，必须存在、启用并适用于当前卡片。 */
  transitionId: string;
  /** 随本次流转写入的字段值；字段必须由 transition.writableFields 允许。 */
  fields: Record<string, unknown>;
  /** 可选流转说明；非空时保存为评论。 */
  comment?: string;
  /** 操作者标识；阶段 4 默认来自 X-Actor，未传时为 human。 */
  actor: string;
}

/** transition 执行成功后的业务结果。 */
export interface RunCardTransitionSuccess {
  ok: true;
  card: Card;
  change: ChangeEvent;
  comment: Comment | null;
}

/** transition 执行失败后的错误结果，status 直接对应 HTTP 状态码。 */
export type RunCardTransitionFailure =
  | { ok: false; status: 400; error: ValidationError }
  | { ok: false; status: 404 }
  | { ok: false; status: 409; error: { field: string; reason: string } };

/** transition 执行结果；调用方按 status 映射统一错误体。 */
export type RunCardTransitionResult = RunCardTransitionSuccess | RunCardTransitionFailure;

function findTransition(config: AppConfig, cardType: string, transitionId: string): TransitionConfig | null {
  return (
    config.transitions.find(
      (item) =>
        item.id === transitionId &&
        item.enabled !== false &&
        (item.cardType === null || item.cardType === undefined || item.cardType === cardType),
    ) ?? null
  );
}

function validateTransitionFields(
  cardType: CardTypeConfig,
  transition: TransitionConfig,
  fields: Record<string, unknown>,
): { ok: true; fields: Record<string, unknown> } | { ok: false; error: ValidationError } {
  const allowed = new Set(transition.writableFields);
  for (const fieldId of Object.keys(fields)) {
    const field = findField(cardType, fieldId);
    if (!field) return { ok: false, error: { field: fieldId, reason: `未知字段 ${fieldId}` } };
    if (!allowed.has(fieldId)) {
      return { ok: false, error: { field: fieldId, reason: `${field.label} 不允许在 ${transition.id} 流转中写入` } };
    }
    if (field.readOnly) return { ok: false, error: { field: fieldId, reason: `${field.label} 是只读字段` } };
    const valueError = validateFieldValue(field, fields[fieldId]);
    if (valueError) return { ok: false, error: valueError };
  }
  for (const fieldId of transition.requiredFields ?? []) {
    const value = fields[fieldId];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0)) {
      const field = findField(cardType, fieldId);
      return { ok: false, error: { field: fieldId, reason: `${field?.label ?? fieldId}不能为空` } };
    }
  }
  return { ok: true, fields };
}

function runInTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * 执行一条已配置的状态流转。
 *
 * 成功时会在同一事务中更新卡片状态、写入允许字段、保存可选评论并记录 changes。
 * 卡片或 transition 不存在返回 404；字段不合法返回 400；当前状态不满足 fromStatus 返回 409。
 */
export function runCardTransition(
  db: DatabaseSync,
  config: AppConfig,
  input: RunCardTransitionInput,
): RunCardTransitionResult {
  const existing = findCardById(db, input.cardId);
  if (!existing) return { ok: false, status: 404 };

  const cardType = findCardType(config, existing.type);
  if (!cardType) {
    return { ok: false, status: 400, error: { field: 'type', reason: `卡片类型配置不存在：${existing.type}` } };
  }

  const transition = findTransition(config, existing.type, input.transitionId);
  if (!transition) return { ok: false, status: 404 };

  if (transition.fromStatus && transition.fromStatus !== existing.status) {
    return {
      ok: false,
      status: 409,
      error: {
        field: 'status',
        reason: `当前状态 ${existing.status} 不允许执行 ${transition.id}，需要 ${transition.fromStatus}`,
      },
    };
  }

  if (transition.toStatus === existing.status) {
    return {
      ok: false,
      status: 409,
      error: {
        field: 'status',
        reason: `当前状态已是 ${existing.status}，无需执行 ${transition.id}`,
      },
    };
  }

  if (!enabledStatusExists(config, transition.toStatus)) {
    return { ok: false, status: 400, error: { field: 'toStatus', reason: `未知目标状态 ${transition.toStatus}` } };
  }

  const fieldResult = validateTransitionFields(cardType, transition, input.fields);
  if (!fieldResult.ok) return { ok: false, status: 400, error: fieldResult.error };

  const result = runInTransaction(db, () => {
    const card = updateCardStateAndFields(db, existing.id, { status: transition.toStatus, fields: fieldResult.fields });
    if (!card) throw new Error(`卡片不存在：${existing.id}`);
    const content = input.comment?.trim();
    const comment = content ? createComment(db, { cardId: existing.id, author: input.actor, content }) : null;
    const change = recordChange(db, {
      event: `card.transition.${transition.id}`,
      cardId: card.id,
      action: transition.id,
      actor: input.actor,
      payload: {
        transitionId: transition.id,
        fromStatus: existing.status,
        toStatus: transition.toStatus,
        fields: fieldResult.fields,
        commentId: comment?.id ?? null,
      },
    });
    return { card, comment, change };
  });
  return { ok: true, ...result };
}
