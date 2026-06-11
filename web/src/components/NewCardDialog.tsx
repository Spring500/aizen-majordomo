import { useEffect, useState } from 'react';
import type { CardType } from '../types.ts';
import { ErrorMessage } from './ErrorMessage.tsx';

export function NewCardDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { type: CardType; title: string; body: string; options?: string[] }) => Promise<void>;
}) {
  const [type, setType] = useState<CardType>('task');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) setError('');
  }, [open]);

  if (!open) return null;

  async function submit() {
    try {
      setError('');
      setCreating(true);
      await onCreate({
        type,
        title,
        body,
        options:
          type === 'decision'
            ? optionsText
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
            : undefined,
      });
      setType('task');
      setTitle('');
      setBody('');
      setOptionsText('');
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
            <select aria-label="类型" value={type} onChange={(event) => setType(event.target.value as CardType)}>
              <option value="task">task</option>
              <option value="decision">decision</option>
              <option value="memo">memo</option>
            </select>
          </label>
          <label className="field">
            <span>标题</span>
            <input aria-label="标题" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>正文</span>
            <textarea aria-label="正文" value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          {type === 'decision' && (
            <label className="field">
              <span>Options，每行一项</span>
              <textarea
                aria-label="Options，每行一项"
                value={optionsText}
                onChange={(event) => setOptionsText(event.target.value)}
              />
            </label>
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
