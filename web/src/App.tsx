import { useCallback, useEffect, useMemo, useState } from 'react';
import { createCard, getCard, listCards, updateCard } from './api/cards.ts';
import { CardDrawer } from './components/CardDrawer.tsx';
import { CardList } from './components/CardList.tsx';
import { ErrorMessage } from './components/ErrorMessage.tsx';
import { NewCardDialog } from './components/NewCardDialog.tsx';
import { SidebarFilters } from './components/SidebarFilters.tsx';
import { Topbar } from './components/Topbar.tsx';
import type { Card, CardFilters } from './types.ts';

export function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Card | null>(null);
  const [filters, setFilters] = useState<CardFilters>({ type: '' });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadCards = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const result = await listCards(filters);
      setCards(result.cards);
      setTotal(result.total);
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
    void loadCards();
  }, [loadCards]);

  const counts = useMemo(() => {
    const next: Record<string, number> = { all: total, task: 0, decision: 0, memo: 0 };
    for (const card of cards) next[card.type] = (next[card.type] ?? 0) + 1;
    return next;
  }, [cards, total]);

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

  async function save(input: Partial<Pick<Card, 'title' | 'body' | 'priority' | 'lane' | 'assignee'>>) {
    if (!selected) return;
    const card = await updateCard(selected.id, input);
    setSelected(card);
    await loadCards();
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
        <SidebarFilters filters={filters} counts={counts} open={filtersOpen} onClose={() => setFiltersOpen(false)} onChange={setFilters} />
        <main className="main-panel">
          <div className="board-header">
            <div className="board-title">
              <h1>本地单人看板</h1>
              <p>{total} 张卡片，按创建时间倒序排列。</p>
            </div>
          </div>
          <ErrorMessage message={error} />
          <CardList cards={cards} selectedId={selected?.id} loading={loading} onSelect={(card) => void selectCard(card)} />
        </main>
        <CardDrawer card={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} onSave={save} />
      </div>
      <NewCardDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreate={create} />
    </div>
  );
}
