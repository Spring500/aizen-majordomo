const pageSizes = [50, 100, 200, 500];

export function CardPagination({
  limit,
  offset,
  total,
  onChange,
  onLimitChange,
}: {
  limit: number;
  offset: number;
  total: number;
  onChange: (offset: number) => void;
  onLimitChange: (limit: number) => void;
}) {
  if (total <= limit && offset === 0) return null;

  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const previousOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  return (
    <nav className="pagination" aria-label="卡片分页">
      <span className="pagination-summary">
        第 {start}-{end} 张 / 共 {total} 张
      </span>
      <div className="pagination-controls">
        <select
          aria-label="每页数量"
          value={limit}
          onChange={(event) => onLimitChange(Number(event.target.value))}
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size} / 页
            </option>
          ))}
        </select>
        <button className="button" type="button" onClick={() => onChange(previousOffset)} disabled={offset === 0}>
          上一页
        </button>
        <button className="button" type="button" onClick={() => onChange(nextOffset)} disabled={nextOffset >= total}>
          下一页
        </button>
      </div>
    </nav>
  );
}
