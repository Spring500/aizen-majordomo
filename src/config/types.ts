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

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDefinition {
  id: string;
  label: string;
  description?: string;
  kind: FieldKind;
  required?: boolean;
  defaultValue?: unknown;
  system?: boolean;
  readOnly?: boolean;
  hidden?: boolean;
  storageKey?: string;
  options?: FieldOption[];
  validation?: Record<string, unknown>;
  ui?: Record<string, unknown>;
}

export type ActionKind = 'create' | 'update' | 'reply' | 'comment' | 'transition' | 'system';

export interface ActionDefinition {
  id: string;
  label: string;
  description?: string;
  kind: ActionKind;
  writableFields: string[];
  requiredFields?: string[];
  system?: boolean;
  enabled?: boolean;
  hidden?: boolean;
  requiresActor?: boolean;
  allowedRoles?: string[];
  conditions?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  effects?: Record<string, unknown>;
}

export interface CardTypeConfig {
  id: string;
  name: string;
  description?: string;
  fields: FieldDefinition[];
  actions: ActionDefinition[];
  enabled?: boolean;
  system?: boolean;
  position?: number;
}

export interface StatusConfig {
  id: string;
  name: string;
  category?: string;
  position: number;
  color?: string;
  enabled?: boolean;
  system?: boolean;
}

export interface TransitionConfig {
  id: string;
  name: string;
  cardType?: string | null;
  fromStatus?: string | null;
  toStatus: string;
  writableFields: string[];
  requiredFields?: string[];
  enabled?: boolean;
  system?: boolean;
}

export interface HookActionModelConfig {
  id: string;
  name: string;
  description?: string;
  schema: Record<string, unknown>;
  enabled?: boolean;
  system?: boolean;
}

export interface HookConfig {
  id: string;
  name: string;
  event: string;
  match?: Record<string, unknown> | null;
  action: Record<string, unknown>;
  enabled?: boolean;
  system?: boolean;
}

export interface AppConfig {
  cardTypes: CardTypeConfig[];
  statuses: StatusConfig[];
  transitions: TransitionConfig[];
  hookActionModels: HookActionModelConfig[];
  hooks: HookConfig[];
}

export type ConfigValidationResult = { ok: true } | { ok: false; errors: string[] };
