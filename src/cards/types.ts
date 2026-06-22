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

// TODO(阶段5-RBAC): 移除 DEFAULT_ACTOR，建卡/流转 actor 由认证上下文强制注入。
export const DEFAULT_ACTOR = 'human';
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 500;
