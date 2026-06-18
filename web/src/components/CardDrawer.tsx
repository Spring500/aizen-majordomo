import { useEffect, useMemo, useState } from 'react';
import type { AppConfig, Card, CardTypeConfig } from '../types.ts';
import { DynamicFieldInput } from './DynamicFields.tsx';
import { ErrorMessage } from './ErrorMessage.tsx';

function actionFields(cardType: CardTypeConfig | undefined, actionId: string) {
  const action = cardType?.actions.find((item) => item.id === actionId && item.enabled !== false);
  return action?.writableFields.map((fieldId) => cardType?.fields.find((field) => field.id === fieldId)).filter(Boolean) ?? [];
}

function hasAction(cardType: CardTypeConfig | undefined, actionId: string) {
  return Boolean(cardType?.actions.find((item) => item.id === actionId && item.enabled !== false));
}

export function CardDrawer({
  card,
  config,
  open,
  onClose,
  onSave,
  onReply,
}: {
  card: Card | null;
  config: AppConfig;
  open: boolean;
  onClose: () => void;
  onSave: (input: { fields: Record<string, unknown> }) => Promise<void>;
  onReply: (input: { fields: Record<string, unknown> }) => Promise<void>;
}) {
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [replying, setReplying] = useState(false);
  const cardType = config.cardTypes.find((item) => item.id === card?.type);
  const fieldsToRender = useMemo(() => actionFields(cardType, 'update'), [cardType]);
  const canReply = hasAction(cardType, 'reply');
  const existingReply = typeof card?.fields.reply === 'string' ? card.fields.reply : card?.reply;
  const repliedBy = card?.fields.replied_by ?? card?.replied_by ?? 'human';
  const statusLabel = config.statuses.find((status) => status.id === card?.status)?.name ?? card?.status ?? '';

  useEffect(() => {
    setFields(card?.fields ?? {});
    setReply('');
    setError('');
    setSaving(false);
    setReplying(false);
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

  async function submitReply() {
    try {
      setError('');
      setReplying(true);
      await onReply({ fields: { reply, replied_by: 'human' } });
      setReply('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交回复失败');
    } finally {
      setReplying(false);
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
          {canReply && (
            <section className="reply-panel" aria-label="正式回复">
              <h3>正式回复</h3>
              {existingReply ? (
                <div className="reply-content">
                  <span>回复人：{String(repliedBy)}</span>
                  <p>{existingReply}</p>
                </div>
              ) : (
                <div className="reply-form">
                  <label className="field">
                    <span>回复内容</span>
                    <textarea
                      aria-label="回复内容"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                    />
                  </label>
                  <button className="button primary" type="button" onClick={submitReply} disabled={replying}>
                    提交回复
                  </button>
                </div>
              )}
            </section>
          )}
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
