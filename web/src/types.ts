export type FieldKind =
  | 'text'
  | 'longText'
  | 'number'
  | 'boolean'
  | 'stringList'
  | 'enum'
  | 'actor'
  | 'datetime'
  | 'json';

export interface FieldDefinition {
  id: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  hidden?: boolean;
}

export interface ActionDefinition {
  id: string;
  label: string;
  kind: string;
  writableFields: string[];
  requiredFields?: string[];
  enabled?: boolean;
}

export interface CardTypeConfig {
  id: string;
  name: string;
  fields: FieldDefinition[];
  actions: ActionDefinition[];
  enabled?: boolean;
}

export interface StatusConfig {
  id: string;
  name: string;
  enabled?: boolean;
}

export interface AppConfig {
  cardTypes: CardTypeConfig[];
  statuses: StatusConfig[];
  transitions: unknown[];
  hookActionModels: unknown[];
  hooks: unknown[];
}

export type CardType = string;

export interface Card {
  id: string;
  type: CardType;
  fields: Record<string, unknown>;
  title: string | null;
  body: string | null;
  options: string[] | null;
  status: string;
  lane: string | null;
  priority: number | null;
  created_by: string;
  assignee: string | null;
  reply: string | null;
  replied_by: string | null;
  created_at: number;
  updated_at: number;
}

export interface CardFilters {
  type: CardType | '';
  status?: string;
  assignee?: string;
  fields?: Record<string, string>;
}
