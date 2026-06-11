import { useEffect, useState } from 'react';
import type { Card } from '../types.ts';
import { ErrorMessage } from './ErrorMessage.tsx';

export function CardDrawer({
  card,
  open,
  onClose,
  onSave,
}: {
  card: Card | null;
  open: boolean;
  onClose: () => void;
  onSave: (input: Partial<Pick<Card, 'title' | 'body' | 'priority' | 'lane' | 'assignee'>>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState(0);
  const [lane, setLane] = useState('');
  const [assignee, setAssignee] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(card?.title ?? '');
    setBody(card?.body ?? '');
    setPriority(card?.priority ?? 0);
    setLane(card?.lane ?? '');
    setAssignee(card?.assignee ?? '');
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
      await onSave({
        title,
        body,
        priority,
        lane: lane || null,
        assignee: assignee || null,
      });
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
            <span>标题</span>
            <input aria-label="标题" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>正文</span>
            <textarea aria-label="正文" value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>优先级</span>
              <input
                aria-label="优先级"
                type="number"
                value={priority}
                onChange={(event) => setPriority(Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span>负责人</span>
              <input aria-label="负责人" value={assignee} onChange={(event) => setAssignee(event.target.value)} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Lane</span>
              <input aria-label="Lane" value={lane} onChange={(event) => setLane(event.target.value)} />
            </label>
            <label className="field">
              <span>Status</span>
              <input aria-label="Status" value={card.status} disabled />
            </label>
          </div>
          {card.options && (
            <section className="field">
              <span>Decision options</span>
              <div className="option-list">
                {card.options.map((option) => (
                  <div className="option-row" key={option}>
                    {option}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      <div className="drawer-foot">
        <span className="save-state">{saving ? '保存中...' : '基础字段可编辑'}</span>
        <button className="button primary" type="button" onClick={submit} disabled={saving}>
          保存
        </button>
      </div>
    </aside>
  );
}
