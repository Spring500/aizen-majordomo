export function Topbar({
  onNewCard,
  onRefresh,
  onOpenFilters,
}: {
  onNewCard: () => void;
  onRefresh: () => void;
  onOpenFilters: () => void;
}) {
  return (
    <header className="topbar">
      <button className="icon-button mobile-only" type="button" onClick={onOpenFilters} aria-label="筛选">
        ☰
      </button>
      <div className="brand">
        <strong>aizen-majordomo</strong>
        <span>本地工作台</span>
      </div>
      <div className="search" aria-hidden="true">
        <span>⌕</span>
        <input placeholder="搜索稍后接入" disabled />
      </div>
      <div className="topbar-actions">
        <button className="button" type="button" onClick={onRefresh}>
          刷新
        </button>
        <button className="button primary" type="button" onClick={onNewCard}>
          新建卡片
        </button>
      </div>
    </header>
  );
}
