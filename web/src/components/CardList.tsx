import type { Card } from '../types.ts';

export function CardList({
  cards,
  selectedId,
  loading,
  onSelect,
}: {
  cards: Card[];
  selectedId?: string;
  loading: boolean;
  onSelect: (card: Card) => void;
}) {
  if (loading) return <div className="empty-state">正在读取卡片...</div>;
  if (cards.length === 0) return <div className="empty-state">还没有卡片。创建第一张 task、decision 或 memo。</div>;

  return (
    <section className="card-list" aria-label="卡片列表">
      {cards.map((card) => (
        <button
          className={`card-row ${selectedId === card.id ? 'selected' : ''}`}
          key={card.id}
          type="button"
          onClick={() => onSelect(card)}
        >
          <span className={`badge ${card.type}`}>{card.type}</span>
          <span className="card-main">
            <strong>{card.title}</strong>
            <small>{card.body || '无正文'}</small>
          </span>
          <span className="priority">P{card.priority}</span>
          <span className="assignee">{card.assignee ?? '未分配'}</span>
        </button>
      ))}
    </section>
  );
}
