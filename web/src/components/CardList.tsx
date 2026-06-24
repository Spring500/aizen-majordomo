import type { WorkspaceConfig, Card, FieldDefinition } from '../types.ts';

function stringifyFieldValue(field: FieldDefinition, value: unknown) {
  if (value === undefined || value === null || value === '') return '';
  if (field.kind === 'enum') {
    const option = field.options?.find((item) => item.value === value);
    return option?.label ?? String(value);
  }
  if (field.kind === 'boolean') return value ? '是' : '否';
  if (field.kind === 'stringList') return Array.isArray(value) ? value.join('、') : String(value);
  if (field.kind === 'json') return '';
  return String(value);
}

function configuredFields(card: Card, config: WorkspaceConfig) {
  return config.cardTypes.find((item) => item.id === card.type)?.fields.filter((field) => !field.hidden) ?? [];
}

function cardPrimaryText(card: Card, fields: FieldDefinition[]) {
  const title = card.fields.title;
  if (typeof title === 'string' && title.trim()) return title;
  const textField = fields.find((field) => field.kind === 'text' && stringifyFieldValue(field, card.fields[field.id]));
  return textField ? stringifyFieldValue(textField, card.fields[textField.id]) : card.id;
}

function cardSecondaryText(card: Card, fields: FieldDefinition[], primary: string) {
  const body = card.fields.body;
  if (typeof body === 'string' && body.trim()) return body;
  for (const field of fields) {
    const value = stringifyFieldValue(field, card.fields[field.id]);
    if (value && value !== primary) return value;
  }
  return '';
}

/**
 * 配置化卡片列表。
 *
 * 列表主副信息来自卡片快捷字段或卡片类型字段配置，状态标签来自 config.statuses。
 */
export function CardList({
  cards,
  config,
  selectedId,
  loading,
  onSelect,
}: {
  cards: Card[];
  config: WorkspaceConfig;
  selectedId?: string;
  loading: boolean;
  onSelect: (card: Card) => void;
}) {
  if (loading) return <div className="empty-state">正在读取卡片...</div>;
  if (cards.length === 0) return <div className="empty-state">还没有卡片。创建第一张 task、decision 或 memo。</div>;

  return (
    <section className="card-list" aria-label="卡片列表">
      {cards.map((card) => {
        const fields = configuredFields(card, config);
        const primary = cardPrimaryText(card, fields);
        const secondary = cardSecondaryText(card, fields, primary);
        const status = config.statuses.find((item) => item.id === card.status);
        return (
          <button
            className={`card-row ${selectedId === card.id ? 'selected' : ''}`}
            key={card.id}
            type="button"
            onClick={() => onSelect(card)}
          >
            <span className={`badge ${card.type}`}>{card.type}</span>
            <span className="card-main">
              <strong>{primary}</strong>
              {secondary && <small>{secondary}</small>}
            </span>
            <span className={`status-pill ${card.status}`}>{status?.name ?? card.status}</span>
            {typeof card.fields.priority === 'number' && <span className="priority">P{card.fields.priority}</span>}
            {typeof card.fields.assignee === 'string' && card.fields.assignee && (
              <span className="assignee">{card.fields.assignee}</span>
            )}
          </button>
        );
      })}
    </section>
  );
}
