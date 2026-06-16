import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCards } from '../../web/src/api/cards.ts';

describe('前端卡片 API 查询参数', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listCards 会发送分页参数', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ cards: [], total: 1000 })));
    vi.stubGlobal('fetch', fetchMock);

    await listCards({ type: '', limit: 100, offset: 200 });

    expect(fetchMock, '列表请求应带 limit/offset。若失败：检查 listCards 是否忽略前端分页状态').toHaveBeenCalledWith(
      '/cards?limit=100&offset=200',
    );
  });
});
