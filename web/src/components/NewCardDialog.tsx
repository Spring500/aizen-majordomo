import { useEffect, useMemo, useState } from 'react';
import type { AppConfig, CardTypeConfig } from '../types.ts';
import { DynamicFieldInput } from './DynamicFields.tsx';
import { ErrorMessage } from './ErrorMessage.tsx';

function actionFields(cardType: CardTypeConfig | undefined, actionId: string) {
  const action = cardType?.actions.find((item) => item.id === actionId && item.enabled !== false);
  return action?.writableFields.map((fieldId) => cardType?.fields.find((field) => field.id === fieldId)).filter(Boolean) ?? [];
}

export function NewCardDialog({
  open,
  config,
  onClose,
  onCreate,
}: {
  open: boolean;
  config: AppConfig;
  onClose: () => void;
  onCreate: (input: { type: string; status?: string; fields: Record<string, unknown> }) => Promise<void>;
}) {
  const enabledTypes = config.cardTypes.filter((item) => item.enabled !== false);
  const enabledStatuses = config.statuses.filter((item) => item.enabled !== false);
  const defaultStatus = config.defaults?.status ?? enabledStatuses[0]?.id ?? 'default';
  const [type, setType] = useState(enabledTypes[0]?.id ?? 'task');
  const [status, setStatus] = useState(defaultStatus);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const cardType = enabledTypes.find((item) => item.id === type) ?? enabledTypes[0];
  const fieldsToRender = useMemo(() => actionFields(cardType, 'create'), [cardType]);

  useEffect(() => {
    if (open && cardType) {
      setType(cardType.id);
      setStatus(defaultStatus);
      const defaults: Record<string, unknown> = {};
      for (const field of fieldsToRender) {
        if (field?.defaultValue !== undefined) defaults[field.id] = field.defaultValue;
      }
      setFields(defaults);
    }
    if (!open) setError('');
  }, [open, cardType?.id]);

  if (!open) return null;

  async function submit() {
    try {
      setError('');
      setCreating(true);
      await onCreate({ type, status, fields });
      setFields({});
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="dialog-backdrop">
      <section className="dialog" aria-label="新建卡片">
        <header>
          <h2>新建卡片</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="form-grid">
          <ErrorMessage message={error} />
          <label className="field">
            <span>类型</span>
            <select aria-label="类型" value={type} onChange={(event) => setType(event.target.value)}>
              {enabledTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
              {enabledStatuses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
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
        <footer>
          <button className="button" type="button" onClick={onClose}>
            取消
          </button>
          <button className="button primary" type="button" onClick={submit} disabled={creating}>
            创建
          </button>
        </footer>
      </section>
    </div>
  );
}
