import type { AppConfig, CardFilters } from '../types.ts';

export function SidebarFilters({
  filters,
  counts,
  config,
  open,
  onClose,
  onChange,
}: {
  filters: CardFilters;
  counts: Record<string, number>;
  config: AppConfig;
  open: boolean;
  onClose: () => void;
  onChange: (filters: CardFilters) => void;
}) {
  function updateFilters(next: CardFilters) {
    onChange(next);
    onClose();
  }
  const riskField = config.cardTypes.flatMap((item) => item.fields).find((field) => field.id === 'risk_level');

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
          <button
            aria-label="全部卡片"
            className={`filter-item ${filters.type === '' ? 'active' : ''}`}
            type="button"
            onClick={() => updateFilters({ ...filters, type: '' })}
          >
            <span>全部卡片</span>
            <span className="count">{counts.all ?? 0}</span>
          </button>
          {config.cardTypes.map((item) => (
            <button
              aria-label={item.name}
              className={`filter-item ${filters.type === item.id ? 'active' : ''}`}
              key={item.id}
              type="button"
              onClick={() => updateFilters({ ...filters, type: item.id })}
            >
              <span>{item.name}</span>
              <span className="count">{counts[item.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="sidebar-section">
        <h2>负责人</h2>
        <label className="field compact-field">
          <span>负责人</span>
          <input
            aria-label="筛选负责人"
            value={filters.assignee ?? ''}
            onChange={(event) => onChange({ ...filters, assignee: event.target.value || undefined })}
            onBlur={onClose}
          />
        </label>
      </section>
      {riskField && (
        <section className="sidebar-section">
          <h2>风险等级</h2>
          <select
            aria-label="筛选风险等级"
            value={filters.fields?.risk_level ?? ''}
            onChange={(event) =>
              updateFilters({
                ...filters,
                fields: { ...(filters.fields ?? {}), risk_level: event.target.value },
              })
            }
          >
            <option value="">全部</option>
            {riskField.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </section>
      )}
      <section className="sidebar-section">
        <h2>阶段</h2>
        <div className="hint-list">
          {config.statuses.map((status) => (
            <span key={status.id}>{status.id}</span>
          ))}
        </div>
      </section>
    </aside>
  );
}
