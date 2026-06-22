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
}

export const DEFAULT_ACTOR = 'human';
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;
