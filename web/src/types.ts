export type CardType = 'task' | 'decision' | 'memo';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  body: string | null;
  options: string[] | null;
  status: string;
  lane: string | null;
  priority: number;
  created_by: string;
  assignee: string | null;
  reply: string | null;
  replied_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface CardFilters {
  type: CardType | '';
}
