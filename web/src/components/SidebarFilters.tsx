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
  const enabledStatuses = config.statuses.filter((status) => status.enabled !== false);

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
        <h2>字段</h2>
        <label className="field compact-field">
          <span>负责人</span>
          <input
            aria-label="筛选负责人"
            value={filters.assignee ?? ''}
            onChange={(event) => onChange({ ...filters, assignee: event.target.value || undefined })}
            onBlur={onClose}
          />
        </label>
        {riskField && (
          <label className="field compact-field">
            <span>风险等级</span>
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
          </label>
        )}
      </section>
      <section className="sidebar-section">
        <h2>状态</h2>
        <div className="filter-list">
          <button
            aria-label="全部状态"
            className={`filter-item ${!filters.status ? 'active' : ''}`}
            type="button"
            onClick={() => updateFilters({ ...filters, status: undefined })}
          >
            <span>全部状态</span>
          </button>
          {enabledStatuses.map((status) => (
            <button
              aria-label={status.name}
              className={`filter-item ${filters.status === status.id ? 'active' : ''}`}
              key={status.id}
              type="button"
              onClick={() => updateFilters({ ...filters, status: status.id })}
            >
              <span>{status.name}</span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
