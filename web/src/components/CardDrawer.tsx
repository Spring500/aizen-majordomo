import { useEffect, useMemo, useState } from 'react';
import type { AppConfig, Card, CardTypeConfig } from '../types.ts';
import { DynamicFieldInput } from './DynamicFields.tsx';
import { ErrorMessage } from './ErrorMessage.tsx';

function actionFields(cardType: CardTypeConfig | undefined, actionId: string) {
  const action = cardType?.actions.find((item) => item.id === actionId && item.enabled !== false);
  return action?.writableFields.map((fieldId) => cardType?.fields.find((field) => field.id === fieldId)).filter(Boolean) ?? [];
}

export function CardDrawer({
  card,
  config,
  open,
  onClose,
  onSave,
}: {
  card: Card | null;
  config: AppConfig;
  open: boolean;
  onClose: () => void;
  onSave: (input: { fields: Record<string, unknown> }) => Promise<void>;
}) {
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const cardType = config.cardTypes.find((item) => item.id === card?.type);
  const fieldsToRender = useMemo(() => actionFields(cardType, 'update'), [cardType]);

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
            <input aria-label="Status" value={card.status} disabled />
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
