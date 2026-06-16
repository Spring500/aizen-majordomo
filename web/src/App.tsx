import { useCallback, useEffect, useMemo, useState } from 'react';
import { getConfig } from './api/config.ts';
import { createCard, getCard, listCards, updateCard } from './api/cards.ts';
import { CardDrawer } from './components/CardDrawer.tsx';
import { CardList } from './components/CardList.tsx';
import { CardPagination } from './components/CardPagination.tsx';
import { ErrorMessage } from './components/ErrorMessage.tsx';
import { NewCardDialog } from './components/NewCardDialog.tsx';
import { SidebarFilters } from './components/SidebarFilters.tsx';
import { Topbar } from './components/Topbar.tsx';
import type { AppConfig, Card, CardFilters } from './types.ts';

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Card | null>(null);
  const [filters, setFilters] = useState<CardFilters>({ type: '', limit: 50, offset: 0 });
  const [total, setTotal] = useState(0);
  const [countsByType, setCountsByType] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : '读取配置失败'));
  }, []);

  const loadCards = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const result = await listCards(filters);
      setCards(result.cards);
      setTotal(result.total);
      setCountsByType(result.countsByType);
      if (selected && !result.cards.some((card) => card.id === selected.id)) {
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取卡片失败');
    } finally {
      setLoading(false);
    }
  }, [filters, selected]);

  useEffect(() => {
    if (config) void loadCards();
  }, [config, loadCards]);

  const counts = useMemo(() => {
    const all = Object.values(countsByType).reduce((sum, count) => sum + count, 0);
    return { all, ...countsByType };
  }, [countsByType]);

  async function selectCard(card: Card) {
    setSelected(await getCard(card.id));
    setFiltersOpen(false);
    setDrawerOpen(true);
  }

  async function create(input: Parameters<typeof createCard>[0]) {
    const card = await createCard(input);
    setSelected(card);
    setDrawerOpen(false);
    await loadCards();
  }

  async function save(input: Parameters<typeof updateCard>[1]) {
    if (!selected) return;
    const card = await updateCard(selected.id, input);
    setSelected(card);
    await loadCards();
  }

  function changeFilters(next: CardFilters) {
    setFilters({ ...next, limit: filters.limit ?? 50, offset: 0 });
  }

  function changePage(offset: number) {
    setFilters((current) => ({ ...current, offset }));
  }

  function changePageSize(limit: number) {
    setFilters((current) => ({ ...current, limit, offset: 0 }));
  }

  if (!config) {
    return (
      <div className="app">
        <Topbar onNewCard={() => undefined} onRefresh={() => undefined} onOpenFilters={() => undefined} />
        <main className="main-panel standalone-panel">
          <ErrorMessage message={error || '正在读取配置...'} />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Topbar
        onNewCard={() => setDialogOpen(true)}
        onRefresh={() => void loadCards()}
        onOpenFilters={() => {
          setDrawerOpen(false);
          setFiltersOpen(true);
        }}
      />
      <div className="workspace">
        <button
          className={`responsive-scrim ${filtersOpen || drawerOpen ? 'open' : ''}`}
          type="button"
          aria-label="关闭覆盖层"
          onClick={() => {
            setFiltersOpen(false);
            setDrawerOpen(false);
          }}
        />
        <SidebarFilters
          filters={filters}
          counts={counts}
          config={config}
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onChange={changeFilters}
        />
        <main className="main-panel">
          <div className="board-header">
            <div className="board-title">
              <h1>本地单人看板</h1>
              <p>{total} 张卡片，按创建时间倒序排列。</p>
            </div>
          </div>
          <ErrorMessage message={error} />
          <div className="card-list-scroll">
            <CardList
              cards={cards}
              config={config}
              selectedId={selected?.id}
              loading={loading}
              onSelect={(card) => void selectCard(card)}
            />
          </div>
          <CardPagination
            limit={filters.limit ?? 50}
            offset={filters.offset ?? 0}
            total={total}
            onChange={changePage}
            onLimitChange={changePageSize}
          />
        </main>
        <CardDrawer card={selected} config={config} open={drawerOpen} onClose={() => setDrawerOpen(false)} onSave={save} />
      </div>
      <NewCardDialog config={config} open={dialogOpen} onClose={() => setDialogOpen(false)} onCreate={create} />
    </div>
  );
}
