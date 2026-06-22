import type { DatabaseSync } from 'node:sqlite';
import type {
  AppConfig,
  CardTypeConfig,
  HookActionModelConfig,
  HookConfig,
  StatusConfig,
  TransitionConfig,
  WorkspaceDefaults,
} from './types.ts';

function bool(value: unknown, fallback = false) {
  if (value === null || value === undefined) return fallback;
  return Boolean(value);
}

function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

export function upsertConfig(db: DatabaseSync, config: AppConfig): void {
  const tx = db.prepare('SELECT 1');
  tx.get();
  for (const item of config.cardTypes) {
    db.prepare(
      `INSERT INTO card_types (id, name, description, fields_json, actions_json, enabled, system, position)
       VALUES (@id, @name, @description, @fields_json, @actions_json, @enabled, @system, @position)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         fields_json = excluded.fields_json,
         actions_json = excluded.actions_json,
         enabled = excluded.enabled,
         system = excluded.system,
         position = excluded.position`,
    ).run({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      fields_json: JSON.stringify(item.fields),
      actions_json: JSON.stringify(item.actions),
      enabled: item.enabled === false ? 0 : 1,
      system: item.system ? 1 : 0,
      position: item.position ?? 0,
    });
  }

  for (const item of config.statuses) {
    db.prepare(
      `INSERT INTO statuses (id, name, category, position, color, enabled, allow_as_initial, system)
       VALUES (@id, @name, @category, @position, @color, @enabled, @allow_as_initial, @system)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         category = excluded.category,
         position = excluded.position,
         color = excluded.color,
         enabled = excluded.enabled,
         allow_as_initial = excluded.allow_as_initial,
         system = excluded.system`,
    ).run({
      id: item.id,
      name: item.name,
      category: item.category ?? null,
      position: item.position,
      color: item.color ?? null,
      enabled: item.enabled === false ? 0 : 1,
      allow_as_initial: item.allowAsInitial === false ? 0 : 1,
      system: item.system ? 1 : 0,
    });
  }

  for (const item of config.transitions) {
    db.prepare(
      `INSERT INTO transitions (
         id, name, card_type, from_status, to_status, writable_fields_json, required_fields_json, enabled, system
       ) VALUES (
         @id, @name, @card_type, @from_status, @to_status, @writable_fields_json, @required_fields_json, @enabled, @system
       )
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         card_type = excluded.card_type,
         from_status = excluded.from_status,
         to_status = excluded.to_status,
         writable_fields_json = excluded.writable_fields_json,
         required_fields_json = excluded.required_fields_json,
         enabled = excluded.enabled,
         system = excluded.system`,
    ).run({
      id: item.id,
      name: item.name,
      card_type: item.cardType ?? null,
      from_status: item.fromStatus ?? null,
      to_status: item.toStatus,
      writable_fields_json: JSON.stringify(item.writableFields),
      required_fields_json: JSON.stringify(item.requiredFields ?? []),
      enabled: item.enabled === false ? 0 : 1,
      system: item.system ? 1 : 0,
    });
  }

  for (const item of config.hookActionModels) {
    db.prepare(
      `INSERT INTO hook_action_models (id, name, description, schema_json, enabled, system)
       VALUES (@id, @name, @description, @schema_json, @enabled, @system)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         schema_json = excluded.schema_json,
         enabled = excluded.enabled,
         system = excluded.system`,
    ).run({
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      schema_json: JSON.stringify(item.schema),
      enabled: item.enabled === false ? 0 : 1,
      system: item.system ? 1 : 0,
    });
  }

  for (const item of config.hooks) {
    db.prepare(
      `INSERT INTO hooks (id, name, event, match_json, action_json, enabled, system)
       VALUES (@id, @name, @event, @match_json, @action_json, @enabled, @system)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         event = excluded.event,
         match_json = excluded.match_json,
         action_json = excluded.action_json,
         enabled = excluded.enabled,
         system = excluded.system`,
    ).run({
      id: item.id,
      name: item.name,
      event: item.event,
      match_json: item.match ? JSON.stringify(item.match) : null,
      action_json: JSON.stringify(item.action),
      enabled: item.enabled === false ? 0 : 1,
      system: item.system ? 1 : 0,
    });
  }

  db.prepare(
    `INSERT INTO settings (key, value) VALUES ('defaults', @value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run({ value: JSON.stringify(config.defaults ?? {}) });
}

export function readConfig(db: DatabaseSync): AppConfig {
  const cardTypes = db
    .prepare('SELECT * FROM card_types ORDER BY position ASC, id ASC')
    .all()
    .map((row: any): CardTypeConfig => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      fields: json(row.fields_json, []),
      actions: json(row.actions_json, []),
      enabled: bool(row.enabled, true),
      system: bool(row.system),
      position: row.position,
    }));

  const statuses = db
    .prepare('SELECT * FROM statuses ORDER BY position ASC, id ASC')
    .all()
    .map((row: any): StatusConfig => ({
      id: row.id,
      name: row.name,
      category: row.category ?? undefined,
      position: row.position,
      color: row.color ?? undefined,
      enabled: bool(row.enabled, true),
      allowAsInitial: bool(row.allow_as_initial, true),
      system: bool(row.system),
    }));

  const transitions = db
    .prepare('SELECT * FROM transitions ORDER BY id ASC')
    .all()
    .map((row: any): TransitionConfig => ({
      id: row.id,
      name: row.name,
      cardType: row.card_type ?? null,
      fromStatus: row.from_status ?? null,
      toStatus: row.to_status,
      writableFields: json(row.writable_fields_json, []),
      requiredFields: json(row.required_fields_json, []),
      enabled: bool(row.enabled, true),
      system: bool(row.system),
    }));

  const hookActionModels = db
    .prepare('SELECT * FROM hook_action_models ORDER BY id ASC')
    .all()
    .map((row: any): HookActionModelConfig => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      schema: json(row.schema_json, {}),
      enabled: bool(row.enabled, true),
      system: bool(row.system),
    }));

  const hooks = db
    .prepare('SELECT * FROM hooks ORDER BY id ASC')
    .all()
    .map((row: any): HookConfig => ({
      id: row.id,
      name: row.name,
      event: row.event,
      match: json(row.match_json, null),
      action: json(row.action_json, {}),
      enabled: bool(row.enabled, true),
      system: bool(row.system),
    }));

  const defaultsRow = db.prepare("SELECT value FROM settings WHERE key = 'defaults'").get() as { value: string } | undefined;
  const defaults = defaultsRow ? json<WorkspaceDefaults>(defaultsRow.value, {}) : {};

  return { cardTypes, statuses, transitions, hookActionModels, hooks, defaults };
}
