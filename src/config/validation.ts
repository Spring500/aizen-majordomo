import { z } from 'zod';
import type { AppConfig, ConfigValidationResult } from './types.ts';

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(['text', 'longText', 'number', 'boolean', 'stringList', 'enum', 'actor', 'datetime', 'json']),
  required: z.boolean().optional(),
  defaultValue: z.unknown().optional(),
  system: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  hidden: z.boolean().optional(),
  storageKey: z.string().optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  validation: z.record(z.unknown()).optional(),
  ui: z.record(z.unknown()).optional(),
});

const actionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  kind: z.enum(['create', 'update', 'reply', 'comment', 'transition', 'system']),
  writableFields: z.array(z.string()),
  requiredFields: z.array(z.string()).optional(),
  system: z.boolean().optional(),
  enabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
  requiresActor: z.boolean().optional(),
  allowedRoles: z.array(z.string()).optional(),
  conditions: z.record(z.unknown()).optional(),
  ui: z.record(z.unknown()).optional(),
  effects: z.record(z.unknown()).optional(),
});

const configSchema = z.object({
  cardTypes: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      fields: z.array(fieldSchema),
      actions: z.array(actionSchema),
      enabled: z.boolean().optional(),
      system: z.boolean().optional(),
      position: z.number().optional(),
    }),
  ),
  statuses: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      category: z.string().optional(),
      position: z.number(),
      color: z.string().optional(),
      enabled: z.boolean().optional(),
      system: z.boolean().optional(),
    }),
  ),
  transitions: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      cardType: z.string().nullable().optional(),
      fromStatus: z.string().nullable().optional(),
      toStatus: z.string(),
      writableFields: z.array(z.string()),
      requiredFields: z.array(z.string()).optional(),
      enabled: z.boolean().optional(),
      system: z.boolean().optional(),
    }),
  ),
  hookActionModels: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      schema: z.record(z.unknown()),
      enabled: z.boolean().optional(),
      system: z.boolean().optional(),
    }),
  ),
  hooks: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      event: z.string().min(1),
      match: z.record(z.unknown()).nullable().optional(),
      action: z.record(z.unknown()),
      enabled: z.boolean().optional(),
      system: z.boolean().optional(),
    }),
  ),
  defaults: z
    .object({
      status: z.string().optional(),
    })
    .optional(),
});

function duplicateIds(items: Array<{ id: string }>, label: string, errors: string[]) {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`${label} duplicate id: ${item.id}`);
    seen.add(item.id);
  }
}

export function validateConfig(input: unknown): ConfigValidationResult {
  const parsed = configSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  }

  const config = parsed.data as AppConfig;
  const errors: string[] = [];
  duplicateIds(config.cardTypes, 'cardTypes', errors);
  duplicateIds(config.statuses, 'statuses', errors);
  duplicateIds(config.transitions, 'transitions', errors);
  duplicateIds(config.hookActionModels, 'hookActionModels', errors);
  duplicateIds(config.hooks, 'hooks', errors);

  const cardTypeIds = new Set(config.cardTypes.map((item) => item.id));
  const statusIds = new Set(config.statuses.map((item) => item.id));
  const transitionIds = new Set(config.transitions.map((item) => item.id));
  const hookActionModelIds = new Set(config.hookActionModels.map((item) => item.id));

  for (const cardType of config.cardTypes) {
    duplicateIds(cardType.fields, `fields ${cardType.id}`, errors);
    duplicateIds(cardType.actions, `actions ${cardType.id}`, errors);
    const fieldIds = new Set(cardType.fields.map((field) => field.id));
    for (const field of cardType.fields) {
      if (field.kind === 'enum' && (!field.options || field.options.length === 0)) {
        errors.push(`field ${cardType.id}.${field.id} enum requires options`);
      }
    }
    for (const action of cardType.actions) {
      for (const fieldId of action.writableFields) {
        if (!fieldIds.has(fieldId)) errors.push(`action ${cardType.id}.${action.id} references missing field ${fieldId}`);
      }
      for (const fieldId of action.requiredFields ?? []) {
        if (!fieldIds.has(fieldId)) errors.push(`action ${cardType.id}.${action.id} requires missing field ${fieldId}`);
        if (!action.writableFields.includes(fieldId)) {
          errors.push(`action ${cardType.id}.${action.id} requires non-writable field ${fieldId}`);
        }
      }
    }
  }

  for (const transition of config.transitions) {
    if (transition.cardType && !cardTypeIds.has(transition.cardType)) {
      errors.push(`transition ${transition.id} references missing card type ${transition.cardType}`);
    }
    if (transition.fromStatus && !statusIds.has(transition.fromStatus)) {
      errors.push(`transition ${transition.id} references missing from_status ${transition.fromStatus}`);
    }
    if (!statusIds.has(transition.toStatus)) {
      errors.push(`transition ${transition.id} references missing to_status ${transition.toStatus}`);
    }
    if (transition.cardType) {
      const cardType = config.cardTypes.find((item) => item.id === transition.cardType);
      const fieldIds = new Set(cardType?.fields.map((field) => field.id) ?? []);
      for (const fieldId of transition.writableFields) {
        if (!fieldIds.has(fieldId)) errors.push(`transition ${transition.id} references missing field ${fieldId}`);
      }
    }
  }

  for (const hook of config.hooks) {
    const type = typeof hook.action.type === 'string' ? hook.action.type : undefined;
    if (type && !hookActionModelIds.has(type)) errors.push(`hook ${hook.id} references missing action model ${type}`);
    if (type === 'transition') {
      const transitionId = typeof hook.action.transitionId === 'string' ? hook.action.transitionId : undefined;
      if (!transitionId || !transitionIds.has(transitionId)) {
        errors.push(`hook ${hook.id} transition action references missing transition ${transitionId ?? ''}`);
      }
    }
  }

  if (config.defaults?.status && !statusIds.has(config.defaults.status)) {
    errors.push(`defaults.status references missing status ${config.defaults.status}`);
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function assertValidConfig(config: AppConfig): void {
  const result = validateConfig(config);
  if (!result.ok) {
    throw new Error(`配置无效: ${result.errors.join('; ')}`);
  }
}
