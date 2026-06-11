import type { CardFilters, CardType } from '../types.ts';

const typeItems: Array<{ label: string; value: CardType | '' }> = [
  { label: '全部卡片', value: '' },
  { label: 'Task', value: 'task' },
  { label: 'Decision', value: 'decision' },
  { label: 'Memo', value: 'memo' },
];

export function SidebarFilters({
  filters,
  counts,
  open,
  onClose,
  onChange,
}: {
  filters: CardFilters;
  counts: Record<string, number>;
  open: boolean;
  onClose: () => void;
  onChange: (filters: CardFilters) => void;
}) {
  function updateFilters(next: CardFilters) {
    onChange(next);
    onClose();
  }

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="筛选">
      <div className="sidebar-head mobile-only">
        <div>
          <h2>筛选</h2>
          <span>与宽屏左侧栏对位</span>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭筛选">
          ×
        </button>
      </div>
      <section className="sidebar-section">
        <h2>类型</h2>
        <div className="filter-list">
          {typeItems.map((item) => (
            <button
              aria-label={item.label}
              className={`filter-item ${filters.type === item.value ? 'active' : ''}`}
              key={item.label}
              type="button"
              onClick={() => updateFilters({ ...filters, type: item.value })}
            >
              <span>{item.label}</span>
              <span className="count">{counts[item.value || 'all'] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="sidebar-section">
        <h2>阶段</h2>
        <div className="hint-list">
          <span>default</span>
          <span>状态流转将在阶段 3 接入</span>
        </div>
      </section>
    </aside>
  );
}
