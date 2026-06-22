import { useEffect, useMemo, useState } from 'react';
import type { AppConfig, Card, CardTypeConfig, TransitionConfig } from '../types.ts';
import { DynamicFieldInput } from './DynamicFields.tsx';
import { ErrorMessage } from './ErrorMessage.tsx';

function actionFields(cardType: CardTypeConfig | undefined, actionId: string) {
  const action = cardType?.actions.find((item) => item.id === actionId && item.enabled !== false);
  return action?.writableFields.map((fieldId) => cardType?.fields.find((field) => field.id === fieldId)).filter(Boolean) ?? [];
}

function availableTransitions(config: AppConfig, card: Card | null) {
  if (!card) return [];
  return config.transitions.filter(
    (transition) =>
      transition.enabled !== false &&
      (transition.cardType === null || transition.cardType === undefined || transition.cardType === card.type) &&
      (transition.fromStatus === null || transition.fromStatus === undefined || transition.fromStatus === card.status) &&
      transition.toStatus !== card.status,
  );
}

function TransitionAction({
  transition,
  cardType,
  card,
  onRun,
}: {
  transition: TransitionConfig;
  cardType: CardTypeConfig | undefined;
  card: Card;
  onRun: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const writableFields = transition.writableFields
    .map((fieldId) => cardType?.fields.find((field) => field.id === fieldId))
    .filter(Boolean);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setFields({});
    setRunning(false);
  }, [card.id, transition.id]);

  async function submit() {
    const nextFields = { ...fields };
    setRunning(true);
    try {
      await onRun(nextFields);
      setFields({});
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="transition-action">
      {writableFields.map((field) =>
        field ? (
          <DynamicFieldInput
            key={field.id}
            field={field}
            value={fields[field.id] ?? card.fields[field.id]}
            onChange={(value) => setFields((current) => ({ ...current, [field.id]: value }))}
          />
        ) : null,
      )}
      <button className="button secondary" type="button" onClick={submit} disabled={running}>
        {running ? '执行中...' : transition.name}
      </button>
    </div>
  );
}

/**
 * 卡片详情抽屉。
 *
 * 普通字段保存通过 onSave 完成；状态变化必须通过 onTransition 执行配置化 transition，
 * 因此该组件只展示 status，不提供直接编辑 status 的入口。
 */
export function CardDrawer({
  card,
  config,
  open,
  onClose,
  onSave,
  onTransition,
}: {
  card: Card | null;
  config: AppConfig;
  open: boolean;
  onClose: () => void;
  onSave: (input: { fields: Record<string, unknown> }) => Promise<void>;
  onTransition: (input: { transitionId: string; fields?: Record<string, unknown>; comment?: string }) => Promise<void>;
}) {
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const cardType = config.cardTypes.find((item) => item.id === card?.type);
  const fieldsToRender = useMemo(() => actionFields(cardType, 'update'), [cardType]);
  const transitions = useMemo(() => availableTransitions(config, card), [config, card]);
  const existingReply = typeof card?.fields.reply === 'string' ? card.fields.reply : card?.reply;
  const statusLabel = config.statuses.find((status) => status.id === card?.status)?.name ?? card?.status ?? '';

  useEffect(() => {
    setFields(card?.fields ?? {});
    setError('');
    setSaving(false);
  }, [card]);

  if (!card) {
    return (
      <aside className="drawer idle" aria-label="卡片详情">
        <div className="drawer-empty">选择一张卡片查看详情。</div>
      </aside>
    );
  }

  async function submit() {
    try {
      setError('');
      setSaving(true);
      await onSave({ fields });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function submitTransition(transition: TransitionConfig, nextFields: Record<string, unknown>) {
    try {
      setError('');
      await onTransition({ transitionId: transition.id, fields: nextFields });
    } catch (err) {
      setError(err instanceof Error ? err.message : '执行流转失败');
    }
  }

  return (
    <aside className={`drawer ${open ? 'open' : ''}`} aria-label="卡片详情">
      <div className="drawer-head">
        <div className="drawer-kicker">
          <span className={`badge ${card.type}`}>{card.type}</span>
          <button className="icon-button mobile-only" type="button" onClick={onClose} aria-label="关闭详情">
            ×
          </button>
          <span className="meta">created by {card.created_by}</span>
        </div>
        <h2>{card.title}</h2>
      </div>
      <div className="drawer-body">
        <div className="form-grid">
          <ErrorMessage message={error} />
          <label className="field">
            <span>Status</span>
            <input aria-label="Status" value={statusLabel} disabled />
          </label>
          {fieldsToRender.map((field) =>
            field ? (
              <DynamicFieldInput
                key={field.id}
                field={field}
                value={fields[field.id]}
                onChange={(value) => setFields((current) => ({ ...current, [field.id]: value }))}
              />
            ) : null,
          )}
          {existingReply && (
            <section className="reply-panel" aria-label="正式回复">
              <h3>正式回复</h3>
              <div className="reply-content">
                <p>{existingReply}</p>
              </div>
            </section>
          )}
          <section className="transition-panel" aria-label="状态流转">
            <h3>状态流转</h3>
            {transitions.length === 0 ? (
              <p className="transition-empty">当前状态没有可执行流转。</p>
            ) : (
              transitions.map((transition) => (
                <TransitionAction
                  key={transition.id}
                  transition={transition}
                  cardType={cardType}
                  card={card}
                  onRun={(nextFields) => submitTransition(transition, nextFields)}
                />
              ))
            )}
          </section>
        </div>
      </div>
      <div className="drawer-foot">
        <span className="save-state">{saving ? '保存中...' : '配置允许字段可编辑'}</span>
        <button className="button primary" type="button" onClick={submit} disabled={saving}>
          保存
        </button>
      </div>
    </aside>
  );
}
