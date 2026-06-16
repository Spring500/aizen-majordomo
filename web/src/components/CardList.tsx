import type { AppConfig, Card, FieldDefinition } from '../types.ts';

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

function configuredFields(card: Card, config: AppConfig) {
  return config.cardTypes.find((item) => item.id === card.type)?.fields.filter((field) => !field.hidden) ?? [];
}

function cardPrimaryText(card: Card, fields: FieldDefinition[]) {
  if (card.title?.trim()) return card.title;
  const textField = fields.find((field) => field.kind === 'text' && stringifyFieldValue(field, card.fields[field.id]));
  return textField ? stringifyFieldValue(textField, card.fields[textField.id]) : card.id;
}

function cardSecondaryText(card: Card, fields: FieldDefinition[], primary: string) {
  if (card.body?.trim()) return card.body;
  for (const field of fields) {
    const value = stringifyFieldValue(field, card.fields[field.id]);
    if (value && value !== primary) return value;
  }
  return '';
}

export function CardList({
  cards,
  config,
  selectedId,
  loading,
  onSelect,
}: {
  cards: Card[];
  config: AppConfig;
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
            {card.priority !== null && <span className="priority">P{card.priority}</span>}
            {card.assignee && <span className="assignee">{card.assignee}</span>}
          </button>
        );
      })}
    </section>
  );
}
