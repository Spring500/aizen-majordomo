import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CardPagination } from '../../web/src/components/CardPagination.tsx';

describe('卡片列表分页控件', () => {
  it('显示当前范围、总数和翻页按钮', () => {
    const html = renderToStaticMarkup(
      <CardPagination limit={50} offset={50} total={1000} onChange={vi.fn()} onLimitChange={vi.fn()} />,
    );

    expect(html, '分页控件应显示当前可见范围。若失败：检查分页摘要是否能证明大量数据可继续查看').toContain(
      '第 51-100 张 / 共 1000 张',
    );
    expect(html, '分页控件应提供上一页。若失败：检查是否只有默认 50 条没有翻页入口').toContain('上一页');
    expect(html, '分页控件应提供下一页。若失败：检查是否只有默认 50 条没有翻页入口').toContain('下一页');
    expect(html, '分页控件应提供 500 上限选项。若失败：检查是否遵守后端 limit 上限').toContain('500 / 页');
  });
});
