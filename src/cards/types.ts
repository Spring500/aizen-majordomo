export const CARD_TYPES = ['task', 'decision', 'memo'] as const;
export type CardType = (typeof CARD_TYPES)[number];

export interface CardRow {
  id: string;
  type: CardType;
  title: string;
  body: string | null;
  options: string | null;
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

export interface Card extends Omit<CardRow, 'options'> {
  options: string[] | null;
}

export const DEFAULT_STATUS = 'default';
export const DEFAULT_ACTOR = 'human';
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;
