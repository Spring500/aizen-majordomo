import { z } from 'zod';
import { CARD_TYPES, DEFAULT_LIMIT, MAX_LIMIT } from './types.ts';

const titleSchema = z
  .string({ required_error: '标题不能为空', invalid_type_error: '标题不能为空' })
  .transform((value) => value.trim())
  .pipe(z.string().min(1, '标题不能为空'));

export const createCardSchema = z.object({
  type: z.enum(CARD_TYPES, {
    required_error: 'type 不能为空',
    invalid_type_error: 'type 必须是 task、decision 或 memo',
  }),
  title: titleSchema,
  body: z.string().nullable().optional(),
  options: z.array(z.string()).optional(),
  status: z.string().optional(),
  lane: z.string().nullable().optional(),
  priority: z.number().int().optional(),
  assignee: z.string().nullable().optional(),
});

export const updateCardSchema = z
  .object({
    title: titleSchema.optional(),
    body: z.string().nullable().optional(),
    priority: z.number().int().optional(),
    lane: z.string().nullable().optional(),
    assignee: z.string().nullable().optional(),
    status: z.unknown().optional(),
  })
  .refine((value) => value.status === undefined, {
    message: '阶段 1 不允许通过 PATCH 修改 status，请等待 transition 接口',
    path: ['status'],
  });

export function parsePagination(url: URL) {
  const all = url.searchParams.get('all') === 'true';
  const rawLimit = url.searchParams.get('limit');
  const rawOffset = url.searchParams.get('offset');

  const limit = rawLimit === null ? DEFAULT_LIMIT : Number(rawLimit);
  const offset = rawOffset === null ? 0 : Number(rawOffset);

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return {
      ok: false as const,
      error: { field: 'limit', reason: `limit 必须是 1 到 ${MAX_LIMIT} 之间的整数` },
    };
  }

  if (!Number.isInteger(offset) || offset < 0) {
    return {
      ok: false as const,
      error: { field: 'offset', reason: 'offset 必须是大于或等于 0 的整数' },
    };
  }

  return { ok: true as const, value: { all, limit, offset } };
}

export function zodFieldError(error: z.ZodError) {
  const issue = error.issues[0];
  return {
    field: String(issue?.path[0] ?? 'body'),
    reason: issue?.message ?? '请求体格式无效',
  };
}
