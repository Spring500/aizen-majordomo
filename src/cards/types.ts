export interface CardCoreRow {
  id: string;
  type: string;
  status: string;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface Card extends CardCoreRow {
  fields: Record<string, unknown>;
  title: string | null;
  body: string | null;
  options: string[] | null;
  lane: string | null;
  priority: number | null;
  assignee: string | null;
  reply: string | null;
  replied_by: string | null;
}

export const DEFAULT_STATUS = 'default';
export const DEFAULT_ACTOR = 'human';
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;

export const FLAT_FIELD_IDS = [
  'title',
  'body',
  'options',
  'lane',
  'priority',
  'assignee',
  'reply',
  'replied_by',
] as const;
