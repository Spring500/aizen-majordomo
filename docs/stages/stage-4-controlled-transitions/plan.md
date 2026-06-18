# 阶段 4 Controlled Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付配置化状态流转执行能力，让卡片状态只能通过合法 transition 改变，并让前端可以触发可用流转。

**Architecture:** 后端新增独立 transition 业务模块，复用阶段 2 的配置模型、阶段 3 的 changes 事件流和现有字段校验。HTTP route 只负责解析请求和映射错误，核心校验、状态更新、字段写入、可选评论和 changes 写入都集中在 `src/cards/transitions.ts`。前端在详情抽屉中把普通保存和状态流转分离，按当前卡片与配置渲染可执行 transition。

**Tech Stack:** Node.js >= 22.5、TypeScript ESM、Hono、SQLite `node:sqlite`、React、Vite、Vitest、Playwright、pnpm。

---

## 0. 执行前置

- 开发必须在非 `main` worktree 中执行。
- 本计划设计来源是 `docs/stages/stage-4-controlled-transitions/design.md` 和 `docs/ROADMAP.md` 的阶段 4。
- 每个新增或修改的测试中，每个 `expect` 都必须带中文辅助信息。
- 本阶段涉及的公开类、接口、公开函数和公开字段必须写中文 JSDoc 注释。
- 注释解释业务契约、字段用途、空值语义和错误语义，不复述“遍历数组”“调用函数”等实现流水账。
- 不提交 `data/`、`.tmp/`、`代理执行笔记/`。

## 1. 文件结构计划

### 后端

- Modify: `src/config/types.ts`
  - 为阶段 4 涉及的配置接口和字段补中文 JSDoc。
- Modify: `src/cards/repository.ts`
  - 新增状态和字段原子更新能力。
- Create: `src/comments/types.ts`
  - 定义最小评论响应类型。
- Create: `src/comments/repository.ts`
  - 提供 `createComment()`。
- Create: `src/cards/transitions.ts`
  - 封装 transition 执行、校验、错误语义和 changes 写入。
- Modify: `src/routes/cards.ts`
  - 增加 `POST /cards/:id/transition`。

### 前端

- Modify: `web/src/types.ts`
  - 将 `transitions` 从 `unknown[]` 升级为 typed config，并补中文 JSDoc。
- Modify: `web/src/api/cards.ts`
  - 增加 `runCardTransition()`。
- Modify: `web/src/App.tsx`
  - 将 transition handler 传给详情抽屉。
- Modify: `web/src/components/CardDrawer.tsx`
  - 展示状态、可用流转、带字段的 transition 表单和错误。
- Modify: `web/src/components/CardList.tsx`
  - 展示配置化状态标签。
- Modify: `web/src/styles.css`
  - 补充 transition 区域和状态标签样式。
- Modify: `tests/web/card-drawer.test.tsx`
  - 更新 CardDrawer props，并验证 transition 回复入口。
- Modify: `tests/web/card-list.test.tsx`
  - 验证配置化状态标签。

### 测试

- Create: `tests/http/card-transitions.test.ts`
  - 覆盖 S4-T3 到 S4-T9、S4-T11。
- Modify: `tests/http/cards.test.ts`
  - 保持或补强 PATCH 禁止 status。
- Modify: `tests/http/config-seed.test.ts`
  - 确认 statuses/transitions 初始化幂等覆盖 S4-T1。
- Create: `tests/e2e/stage4-controlled-transitions.spec.ts`
  - 覆盖前端合法流转，包含宽屏和窄屏路径。

## 2. Task 1: 注释配置类型并锁定配置契约

**Files:**
- Modify: `src/config/types.ts`
- Modify: `web/src/types.ts`
- Modify: `tests/http/config-seed.test.ts`

- [ ] **Step 1: 补配置幂等测试**

在 `tests/http/config-seed.test.ts` 增加或确认以下测试，若已有等价覆盖则只补缺失断言：

```ts
import { initializeConfig } from '../../src/config/initialize.ts';

it('重复初始化 statuses 和 transitions 不产生重复数据', () => {
  delete process.env.CONFIG_SEED_PATH;
  const db = createDb(':memory:');
  const seed = loadSeedConfig();

  initializeConfig(db);
  initializeConfig(db);

  const statusCount = db.prepare('SELECT COUNT(*) AS total FROM statuses').get() as { total: number };
  const transitionCount = db.prepare('SELECT COUNT(*) AS total FROM transitions').get() as { total: number };

  expect(statusCount.total, '重复初始化后 statuses 数量应等于样例配置数量，不能插入重复状态').toBe(
    seed.statuses.length,
  );
  expect(transitionCount.total, '重复初始化后 transitions 数量应等于样例配置数量，不能插入重复流转').toBe(
    seed.transitions.length,
  );
});
```

Run:

```powershell
pnpm test -- tests/http/config-seed.test.ts
```

Expected: PASS。

- [ ] **Step 2: 为后端配置类型补中文 JSDoc**

在 `src/config/types.ts` 中为 `FieldDefinition`、`ActionDefinition`、`CardTypeConfig`、`StatusConfig`、`TransitionConfig`、`HookActionModelConfig`、`HookConfig`、`AppConfig` 及其公开字段补中文注释。`TransitionConfig` 必须明确以下语义：

```ts
/**
 * 描述一条可执行的状态流转规则。
 *
 * transition 是状态变化的业务入口：调用方指定 transition id 后，
 * 服务会校验卡片类型、当前状态和随流转写入的字段，再把卡片推进到 toStatus。
 */
export interface TransitionConfig {
  /** 流转唯一标识。前端按钮、API 请求和 hook action 都通过该 id 引用流转。 */
  id: string;
  /** 展示给人类用户的流转名称，例如“开始处理”或“提交回复”。 */
  name: string;
  /** 限定适用的卡片类型；为 null 或未设置时表示适用于所有卡片类型。 */
  cardType?: string | null;
  /** 要求卡片当前处于的来源状态；为 null 或未设置时表示可从任意状态执行。 */
  fromStatus?: string | null;
  /** 执行成功后写入 cards.status 的目标状态。 */
  toStatus: string;
  /** 本次流转允许顺带写入的字段 id 列表，不等同于普通 update action 的可写字段。 */
  writableFields: string[];
  /** 本次流转必须提供的字段 id 列表，字段必须同时出现在 writableFields 中。 */
  requiredFields?: string[];
  /** 为 false 时该流转不可被前端展示，也不可被 API 执行。 */
  enabled?: boolean;
  /** 标记是否为内置样例配置，阶段 7 会用它区分用户管理配置。 */
  system?: boolean;
}
```

- [ ] **Step 3: 为前端配置类型补中文 JSDoc 并 typed transitions**

在 `web/src/types.ts` 新增 `TransitionConfig`，并把 `AppConfig.transitions` 从 `unknown[]` 改为 `TransitionConfig[]`：

```ts
/** 前端渲染和提交状态流转时使用的 transition 配置。 */
export interface TransitionConfig {
  /** 流转唯一标识，请求 `POST /cards/:id/transition` 时作为 transitionId 传递。 */
  id: string;
  /** 展示给用户的按钮或操作名称。 */
  name: string;
  /** 限定卡片类型；为空时表示所有卡片类型都可考虑该流转。 */
  cardType?: string | null;
  /** 限定来源状态；为空时表示可从任意状态执行。 */
  fromStatus?: string | null;
  /** 执行成功后的目标状态。 */
  toStatus: string;
  /** 执行该流转时允许填写的字段。 */
  writableFields: string[];
  /** 执行该流转时必须填写的字段。 */
  requiredFields?: string[];
  /** 为 false 时前端不展示该流转。 */
  enabled?: boolean;
}
```

- [ ] **Step 4: 跑类型检查**

Run:

```powershell
pnpm typecheck
```

Expected: PASS。

## 3. Task 2: 后端 transition 执行核心

**Files:**
- Modify: `src/cards/repository.ts`
- Create: `src/comments/types.ts`
- Create: `src/comments/repository.ts`
- Create: `src/cards/transitions.ts`
- Create: `tests/http/card-transitions.test.ts`

- [ ] **Step 1: 写合法 transition 失败测试**

创建 `tests/http/card-transitions.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.ts';

async function createTask(app: ReturnType<typeof createTestApp>['app']) {
  const res = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
    body: JSON.stringify({ type: 'task', fields: { title: '阶段四任务' } }),
  });
  return (await res.json()).card;
}

describe('POST /cards/:id/transition', () => {
  it('合法 transition 会把卡片状态改为目标状态', async () => {
    const { app } = createTestApp();
    const card = await createTask(app);

    const res = await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ transitionId: 'start' }),
    });
    const body = await res.json();

    expect(res.status, 'default 状态 task 执行 start 应成功').toBe(200);
    expect(body.card.status, 'start transition 应把状态推进到 active').toBe('active');
    expect(body.change.event, '状态流转应写入可被 agent 识别的 transition 事件').toBe('card.transition.start');
  });
});
```

Run:

```powershell
pnpm test -- tests/http/card-transitions.test.ts
```

Expected: FAIL，原因是 transition 路由尚未实现。

- [ ] **Step 2: 新增状态和字段更新函数**

在 `src/cards/repository.ts` 增加公开函数，并写中文 JSDoc：

```ts
/**
 * 在一次卡片业务操作中更新状态和字段。
 *
 * transition 服务使用该函数保证 `cards.status`、字段值和 `updated_at`
 * 表达同一次状态流转的结果；调用方负责开启事务和完成业务校验。
 */
export function updateCardStateAndFields(
  db: DatabaseSync,
  id: string,
  input: { status: string; fields: Record<string, unknown> },
): Card | null {
  const existing = findCardById(db, id);
  if (!existing) return null;
  const now = Date.now();
  writeFieldValues(db, id, input.fields, now);
  db.prepare('UPDATE cards SET status = @status, updated_at = @updated_at WHERE id = @id').run({
    id,
    status: input.status,
    updated_at: now,
  });
  return findCardById(db, id);
}
```

- [ ] **Step 3: 新增最小评论 repository**

`src/comments/types.ts`：

```ts
/** transition 附带说明保存后的最小评论响应。 */
export interface Comment {
  /** 评论唯一标识。 */
  id: string;
  /** 评论所属卡片 id。 */
  cardId: string;
  /** 评论作者；阶段 4 使用请求 actor，未传时为 human。 */
  author: string;
  /** 评论正文。空白评论不会被 transition 服务写入。 */
  content: string;
  /** 创建时间戳，单位毫秒。 */
  createdAt: number;
}
```

`src/comments/repository.ts`：

```ts
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { Comment } from './types.ts';

/**
 * 为卡片追加一条纯文本评论。
 *
 * 阶段 4 只用于 transition 附带说明；完整评论读取、权限和评论区 UI 留到阶段 6。
 */
export function createComment(
  db: DatabaseSync,
  input: { cardId: string; author: string; content: string; at?: number },
): Comment {
  const comment = {
    id: randomUUID(),
    cardId: input.cardId,
    author: input.author,
    content: input.content,
    createdAt: input.at ?? Date.now(),
  };
  db.prepare(
    `INSERT INTO comments (id, card_id, author, content, created_at)
     VALUES (@id, @cardId, @author, @content, @createdAt)`,
  ).run(comment);
  return comment;
}
```

- [ ] **Step 4: 实现 transition 结果类型和查找逻辑**

`src/cards/transitions.ts`：

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { AppConfig, CardTypeConfig, TransitionConfig } from '../config/types.ts';
import type { ChangeEvent } from '../changes/types.ts';
import type { Comment } from '../comments/types.ts';
import { recordChange } from '../changes/repository.ts';
import { createComment } from '../comments/repository.ts';
import {
  enabledStatusExists,
  findCardById,
  findCardType,
  findField,
  updateCardStateAndFields,
  validateFieldValue,
  type ValidationError,
} from './repository.ts';
import type { Card } from './types.ts';

/** 执行 transition 的输入；HTTP route 和未来 hook 都应使用这个结构。 */
export interface RunCardTransitionInput {
  /** 要流转的卡片 id。 */
  cardId: string;
  /** 要执行的 transition id，必须存在、启用并适用于当前卡片。 */
  transitionId: string;
  /** 随本次流转写入的字段值；字段必须由 transition.writableFields 允许。 */
  fields: Record<string, unknown>;
  /** 可选流转说明；非空时保存为评论。 */
  comment?: string;
  /** 操作者标识；阶段 4 默认来自 X-Actor，未传时为 human。 */
  actor: string;
}

/** transition 执行成功后的业务结果。 */
export interface RunCardTransitionSuccess {
  ok: true;
  card: Card;
  change: ChangeEvent;
  comment: Comment | null;
}

/** transition 执行失败后的错误结果，status 直接对应 HTTP 状态码。 */
export type RunCardTransitionFailure =
  | { ok: false; status: 400; error: ValidationError }
  | { ok: false; status: 404 }
  | { ok: false; status: 409; error: { field: string; reason: string } };

/** transition 执行结果；调用方按 status 映射统一错误体。 */
export type RunCardTransitionResult = RunCardTransitionSuccess | RunCardTransitionFailure;

function findTransition(config: AppConfig, cardType: string, transitionId: string): TransitionConfig | null {
  return (
    config.transitions.find(
      (item) =>
        item.id === transitionId &&
        item.enabled !== false &&
        (item.cardType === null || item.cardType === undefined || item.cardType === cardType),
    ) ?? null
  );
}

function validateTransitionFields(
  cardType: CardTypeConfig,
  transition: TransitionConfig,
  fields: Record<string, unknown>,
): { ok: true; fields: Record<string, unknown> } | { ok: false; error: ValidationError } {
  const allowed = new Set(transition.writableFields);
  for (const fieldId of Object.keys(fields)) {
    const field = findField(cardType, fieldId);
    if (!field) return { ok: false, error: { field: fieldId, reason: `未知字段 ${fieldId}` } };
    if (!allowed.has(fieldId)) {
      return { ok: false, error: { field: fieldId, reason: `${field.label} 不允许在 ${transition.id} 流转中写入` } };
    }
    if (field.readOnly) return { ok: false, error: { field: fieldId, reason: `${field.label} 是只读字段` } };
    const valueError = validateFieldValue(field, fields[fieldId]);
    if (valueError) return { ok: false, error: valueError };
  }
  for (const fieldId of transition.requiredFields ?? []) {
    const value = fields[fieldId];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0)) {
      const field = findField(cardType, fieldId);
      return { ok: false, error: { field: fieldId, reason: `${field?.label ?? fieldId}不能为空` } };
    }
  }
  return { ok: true, fields };
}

function runInTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
```

- [ ] **Step 5: 实现 runCardTransition**

在同文件继续添加：

```ts
/**
 * 执行一条已配置的状态流转。
 *
 * 成功时会在同一事务中更新卡片状态、写入允许字段、保存可选评论并记录 changes。
 * 卡片或 transition 不存在返回 404；字段不合法返回 400；当前状态不满足 fromStatus 返回 409。
 */
export function runCardTransition(
  db: DatabaseSync,
  config: AppConfig,
  input: RunCardTransitionInput,
): RunCardTransitionResult {
  const existing = findCardById(db, input.cardId);
  if (!existing) return { ok: false, status: 404 };

  const cardType = findCardType(config, existing.type);
  if (!cardType) {
    return { ok: false, status: 400, error: { field: 'type', reason: `卡片类型配置不存在：${existing.type}` } };
  }

  const transition = findTransition(config, existing.type, input.transitionId);
  if (!transition) return { ok: false, status: 404 };

  if (transition.fromStatus && transition.fromStatus !== existing.status) {
    return {
      ok: false,
      status: 409,
      error: {
        field: 'status',
        reason: `当前状态 ${existing.status} 不允许执行 ${transition.id}，需要 ${transition.fromStatus}`,
      },
    };
  }

  if (!enabledStatusExists(config, transition.toStatus)) {
    return { ok: false, status: 400, error: { field: 'toStatus', reason: `未知目标状态 ${transition.toStatus}` } };
  }

  const fieldResult = validateTransitionFields(cardType, transition, input.fields);
  if (!fieldResult.ok) return { ok: false, status: 400, error: fieldResult.error };

  const result = runInTransaction(db, () => {
    const card = updateCardStateAndFields(db, existing.id, { status: transition.toStatus, fields: fieldResult.fields });
    if (!card) throw new Error(`卡片不存在：${existing.id}`);
    const content = input.comment?.trim();
    const comment = content ? createComment(db, { cardId: existing.id, author: input.actor, content }) : null;
    const change = recordChange(db, {
      event: `card.transition.${transition.id}`,
      cardId: card.id,
      action: transition.id,
      actor: input.actor,
      payload: {
        transitionId: transition.id,
        fromStatus: existing.status,
        toStatus: transition.toStatus,
        fields: fieldResult.fields,
        commentId: comment?.id ?? null,
      },
    });
    return { card, comment, change };
  });
  return { ok: true, ...result };
}
```

- [ ] **Step 6: 暂不挂路由，运行单文件测试确认仍失败**

Run:

```powershell
pnpm test -- tests/http/card-transitions.test.ts
```

Expected: 仍 FAIL，因为 route 未挂载；TypeScript 编译不应因新增模块失败。

## 4. Task 3: HTTP transition 路由和错误语义

**Files:**
- Modify: `src/routes/cards.ts`
- Modify: `tests/http/card-transitions.test.ts`

- [ ] **Step 1: 新增 transition body 解析**

在 `src/routes/cards.ts` 增加本地解析函数：

```ts
function normalizeTransitionBody(input: unknown):
  | { ok: true; value: { transitionId: string; fields: Record<string, unknown>; comment?: string } }
  | { ok: false; error: { field: string; reason: string } } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: { field: 'body', reason: '请求体必须是对象' } };
  }
  const body = input as Record<string, unknown>;
  if (typeof body.transitionId !== 'string' || body.transitionId.trim().length === 0) {
    return { ok: false, error: { field: 'transitionId', reason: 'transitionId 不能为空' } };
  }
  const fields = body.fields === undefined ? {} : body.fields;
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
    return { ok: false, error: { field: 'fields', reason: 'fields 必须是对象' } };
  }
  if (body.comment !== undefined && typeof body.comment !== 'string') {
    return { ok: false, error: { field: 'comment', reason: 'comment 必须是字符串' } };
  }
  return {
    ok: true,
    value: {
      transitionId: body.transitionId,
      fields: fields as Record<string, unknown>,
      comment: body.comment,
    },
  };
}
```

- [ ] **Step 2: 挂载路由**

在 `cards.patch('/:id')` 前或后增加：

```ts
cards.post('/:id/transition', async (c) => {
  const parsed = normalizeTransitionBody(await c.req.json().catch(() => undefined));
  if (!parsed.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', parsed.error);

  const config = readConfig(c.get('db'));
  const result = runCardTransition(c.get('db'), config, {
    cardId: c.req.param('id'),
    transitionId: parsed.value.transitionId,
    fields: parsed.value.fields,
    comment: parsed.value.comment,
    actor: c.req.header('X-Actor') ?? 'human',
  });

  if (!result.ok && result.status === 404) return notFound(c);
  if (!result.ok && result.status === 409) {
    return c.json({ error: { code: 'TRANSITION_CONFLICT', message: '当前状态不允许执行该流转', details: result.error } }, 409);
  }
  if (!result.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', result.error);

  return c.json({ card: result.card, change: result.change, comment: result.comment });
});
```

导入：

```ts
import { runCardTransition } from '../cards/transitions.ts';
```

- [ ] **Step 3: 跑合法 transition 测试**

Run:

```powershell
pnpm test -- tests/http/card-transitions.test.ts
```

Expected: PASS。

- [ ] **Step 4: 补 transition 不存在测试**

```ts
it('transition 不存在时返回 404', async () => {
  const { app } = createTestApp();
  const card = await createTask(app);

  const res = await app.request(`/cards/${card.id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transitionId: 'missing_transition' }),
  });

  expect(res.status, '未知 transitionId 应返回 404，避免伪装成字段校验错误').toBe(404);
});
```

- [ ] **Step 5: 补状态冲突测试**

```ts
it('当前状态不满足 fromStatus 时返回 409', async () => {
  const { app } = createTestApp();
  const card = await createTask(app);

  const res = await app.request(`/cards/${card.id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transitionId: 'submit_reply', fields: { reply: '不应允许' } }),
  });
  const body = await res.json();

  expect(res.status, 'default 状态不满足 submit_reply 的 waiting 来源状态，应返回 409').toBe(409);
  expect(body.error.details.field, '冲突错误详情应指向 status，便于调用方理解当前状态不允许').toBe('status');
});
```

- [ ] **Step 6: 补全局 transition 测试**

```ts
it('全局 transition 能从任意状态执行', async () => {
  const { app } = createTestApp();
  const card = await createTask(app);

  const res = await app.request(`/cards/${card.id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transitionId: 'complete' }),
  });
  const body = await res.json();

  expect(res.status, 'complete 的 fromStatus 为 null，应允许从 default 直接执行').toBe(200);
  expect(body.card.status, 'complete transition 应把卡片状态改为 done').toBe('done');
});
```

- [ ] **Step 7: 跑 transition HTTP 测试**

Run:

```powershell
pnpm test -- tests/http/card-transitions.test.ts
```

Expected: PASS。

## 5. Task 4: transition 字段、评论和 changes

**Files:**
- Modify: `tests/http/card-transitions.test.ts`
- Modify: `src/cards/transitions.ts`
  - 保持字段、评论和 changes 写入符合本任务新增测试。

- [ ] **Step 1: 补允许字段写入测试**

```ts
async function createWaitingDecision(app: ReturnType<typeof createTestApp>['app']) {
  const res = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
    body: JSON.stringify({ type: 'decision', status: 'waiting', fields: { title: '需要回复' } }),
  });
  return (await res.json()).card;
}

it('transition 可随请求写入允许字段', async () => {
  const { app } = createTestApp();
  const card = await createWaitingDecision(app);

  const res = await app.request(`/cards/${card.id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
    body: JSON.stringify({ transitionId: 'submit_reply', fields: { reply: '采用 A', replied_by: 'human' } }),
  });
  const body = await res.json();

  expect(res.status, 'waiting decision 执行 submit_reply 并写入 reply 应成功').toBe(200);
  expect(body.card.status, 'submit_reply 应把 decision 状态改为 resolved').toBe('resolved');
  expect(body.card.fields.reply, 'submit_reply 应持久化 reply 字段').toBe('采用 A');
  expect(body.card.fields.replied_by, 'submit_reply 应持久化 replied_by 字段').toBe('human');
});
```

- [ ] **Step 2: 补未允许字段测试**

```ts
it('transition 请求携带未允许字段时返回 400 且不写入卡片', async () => {
  const { app } = createTestApp();
  const card = await createWaitingDecision(app);

  const res = await app.request(`/cards/${card.id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transitionId: 'submit_reply', fields: { reply: '采用 A', title: '不允许改标题' } }),
  });
  const body = await res.json();
  const after = await (await app.request(`/cards/${card.id}`)).json();

  expect(res.status, 'transition 写入未声明字段应返回 400').toBe(400);
  expect(body.error.details.field, '错误详情应指出未允许字段 title').toBe('title');
  expect(after.card.status, '字段校验失败时不应修改状态').toBe('waiting');
  expect(after.card.fields.title, '字段校验失败时不应写入未允许的新标题').toBe('需要回复');
});
```

- [ ] **Step 3: 补评论测试**

```ts
it('transition 可附带评论并保存', async () => {
  const { app, db } = createTestApp();
  const card = await createTask(app);

  const res = await app.request(`/cards/${card.id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
    body: JSON.stringify({ transitionId: 'start', comment: '开始处理这个任务' }),
  });
  const body = await res.json();
  const row = db.prepare('SELECT * FROM comments WHERE card_id = @card_id').get({ card_id: card.id }) as any;

  expect(res.status, '带 comment 的合法 transition 应成功').toBe(200);
  expect(body.comment.content, '响应应返回本次保存的评论内容').toBe('开始处理这个任务');
  expect(row.content, 'transition 附带评论应写入 comments 表').toBe('开始处理这个任务');
  expect(row.author, '评论作者应使用 X-Actor').toBe('human');
});
```

- [ ] **Step 4: 补 changes 测试**

```ts
it('transition 写入 changes，agent 可通过 since 游标读取', async () => {
  const { app } = createTestApp();
  const card = await createTask(app);
  const before = await (await app.request('/changes?since=0')).json();

  await app.request(`/cards/${card.id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
    body: JSON.stringify({ transitionId: 'start' }),
  });
  const body = await (await app.request(`/changes?since=${before.latestSeq}`)).json();

  expect(body.changes.length, '从 transition 前游标读取应只返回本次状态流转事件').toBe(1);
  expect(body.changes[0].event, 'transition 事件名应包含 transition id').toBe('card.transition.start');
  expect(body.changes[0].payload.fromStatus, 'transition changes payload 应包含来源状态').toBe('default');
  expect(body.changes[0].payload.toStatus, 'transition changes payload 应包含目标状态').toBe('active');
});
```

- [ ] **Step 5: 跑 transition 全量 HTTP 测试**

Run:

```powershell
pnpm test -- tests/http/card-transitions.test.ts tests/http/changes.test.ts tests/http/cards.test.ts
```

Expected: PASS。

## 6. Task 5: 前端 API 和详情抽屉流转控件

**Files:**
- Modify: `web/src/api/cards.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/CardDrawer.tsx`
- Modify: `web/src/components/CardList.tsx`
- Modify: `web/src/styles.css`
- Modify: `tests/web/card-drawer.test.tsx`
- Modify: `tests/web/card-list.test.tsx`

- [ ] **Step 1: 增加前端 transition API**

在 `web/src/api/cards.ts` 增加：

```ts
export async function runCardTransition(
  id: string,
  input: { transitionId: string; fields?: Record<string, unknown>; comment?: string },
): Promise<Card> {
  const res = await fetch(`/cards/${id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, fields: input.fields ?? {} }),
  });
  return (await parseResponse<CardResponse>(res)).card;
}
```

- [ ] **Step 2: App 传入 transition handler**

在 `web/src/App.tsx` 导入 `runCardTransition`，添加：

```ts
async function transition(input: { transitionId: string; fields?: Record<string, unknown>; comment?: string }) {
  if (!selected) return;
  const card = await runCardTransition(selected.id, input);
  setSelected(card);
  await loadCards();
}
```

传给 `CardDrawer`：

```tsx
<CardDrawer
  card={selected}
  config={config}
  open={drawerOpen}
  onClose={() => setDrawerOpen(false)}
  onSave={save}
  onTransition={transition}
/>
```

- [ ] **Step 3: CardDrawer 筛选可用 transition**

在 `CardDrawer.tsx` 增加 helper：

```ts
function availableTransitions(config: AppConfig, card: Card | null) {
  if (!card) return [];
  return config.transitions.filter(
    (transition) =>
      transition.enabled !== false &&
      (transition.cardType === null || transition.cardType === undefined || transition.cardType === card.type) &&
      (transition.fromStatus === null || transition.fromStatus === undefined || transition.fromStatus === card.status),
  );
}
```

组件 props 增加：

```ts
onTransition: (input: { transitionId: string; fields?: Record<string, unknown>; comment?: string }) => Promise<void>;
```

- [ ] **Step 4: CardDrawer 渲染 transition 表单**

在详情表单保存区前增加 transition 区域。实现要求：

```tsx
<section className="transition-panel" aria-label="状态流转">
  <h3>状态流转</h3>
  {transitions.length === 0 ? (
    <p className="transition-empty">当前状态没有可执行流转。</p>
  ) : (
    transitions.map((transition) => (
      <TransitionAction
        key={transition.id}
        transition={transition}
        cardType={cardType}
        onRun={async (fields) => {
          setError('');
          await onTransition({ transitionId: transition.id, fields });
        }}
      />
    ))
  )}
</section>
```

新增局部组件：

```tsx
function TransitionAction({
  transition,
  cardType,
  onRun,
}: {
  transition: TransitionConfig;
  cardType: CardTypeConfig | undefined;
  onRun: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const writableFields = transition.writableFields
    .map((fieldId) => cardType?.fields.find((field) => field.id === fieldId))
    .filter(Boolean);
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [running, setRunning] = useState(false);

  async function submit() {
    setRunning(true);
    try {
      await onRun(fields);
      setFields({});
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="transition-action">
      {writableFields.map((field) =>
        field ? (
          <DynamicFieldInput
            key={field.id}
            field={field}
            value={fields[field.id]}
            onChange={(value) => setFields((current) => ({ ...current, [field.id]: value }))}
          />
        ) : null,
      )}
      <button className="button secondary" type="button" onClick={submit} disabled={running}>
        {running ? '执行中...' : transition.name}
      </button>
    </div>
  );
}
```

同时在文件顶部从 `../types.ts` 导入 `TransitionConfig`：

```ts
import type { AppConfig, Card, CardTypeConfig, TransitionConfig } from '../types.ts';
```

- [ ] **Step 5: 保留旧 reply action 但前端 reply 改走 transition**

将 CardDrawer 中旧的“提交回复”区并入 transition 渲染。若保留已有 `onReply` prop 会造成重复入口，应从 `CardDrawer` props 移除 `onReply`，但后端 `/actions/reply` 仍保留。

`App.tsx` 中删除前端 `reply()` handler 和 `runCardAction` import。阶段 4 前端不再直接调用 `/cards/:id/actions/reply`。

- [ ] **Step 6: CardList 展示状态标签**

在 `CardList.tsx` 中查找状态：

```ts
const status = config.statuses.find((item) => item.id === card.status);
```

渲染：

```tsx
<span className={`status-pill ${card.status}`}>{status?.name ?? card.status}</span>
```

保留等待回复的额外判断时，避免重复显示两个相同标签。

- [ ] **Step 7: 补 CSS**

在 `web/src/styles.css` 添加：

```css
.transition-panel {
  display: grid;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}

.transition-action {
  display: grid;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.transition-empty {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
```

- [ ] **Step 8: 跑前端相关测试和类型检查**

先更新 `tests/web/card-drawer.test.tsx` 中的 `config.transitions`，让 waiting decision 有 `submit_reply`：

```ts
transitions: [
  {
    id: 'submit_reply',
    name: '提交回复',
    cardType: 'decision',
    fromStatus: 'waiting',
    toStatus: 'resolved',
    writableFields: ['reply', 'replied_by'],
    requiredFields: ['reply'],
  },
],
```

渲染 `CardDrawer` 时移除 `onReply`，增加：

```tsx
onTransition={async () => undefined}
```

把“声明 reply action 的 decision 会显示正式回复输入区”测试改名为“waiting decision 会通过 submit_reply transition 显示正式回复入口”，并保留这些断言：

```ts
expect(html, 'submit_reply transition 应渲染正式回复字段。若失败：检查 CardDrawer 是否按 transition.writableFields 渲染').toContain(
  '正式回复',
);
expect(html, 'submit_reply transition 应显示提交回复按钮。若失败：检查 transition.name 是否作为按钮文案').toContain(
  '提交回复',
);
```

在 `tests/web/card-list.test.tsx` 的 `decisionConfig.statuses` 中加入：

```ts
statuses: [{ id: 'waiting', name: '等待回复' }],
```

并新增断言：

```ts
expect(html, '列表应使用配置化状态名称展示状态标签。若失败：检查 CardList 是否映射 config.statuses').toContain(
  '等待回复',
);
```

Run:

```powershell
pnpm test -- tests/web/card-drawer.test.tsx tests/web/card-list.test.tsx
pnpm typecheck
```

Expected: PASS。

## 7. Task 6: E2E 覆盖宽屏和窄屏流转

**Files:**
- Create: `tests/e2e/stage4-controlled-transitions.spec.ts`

- [ ] **Step 1: 写宽屏 task 流转测试**

```ts
import { expect, test } from '@playwright/test';

async function createTask(page: import('@playwright/test').Page, title: string) {
  return page.evaluate(async (cardTitle) => {
    const res = await fetch('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ type: 'task', fields: { title: cardTitle } }),
    });
    if (!res.ok) throw new Error(`创建 task 失败: ${res.status}`);
    return ((await res.json()) as { card: { id: string } }).card.id;
  }, title);
}

test('阶段 4 宽屏可执行合法状态流转', async ({ page }) => {
  await page.goto('/');
  await createTask(page, '阶段四宽屏任务');
  await page.reload();

  await page.getByRole('button', { name: /阶段四宽屏任务/ }).click();
  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await drawer.getByRole('button', { name: '开始处理' }).click();

  await expect(
    drawer.getByLabel('Status'),
    '执行开始处理后详情中的状态应更新为处理中。若失败：检查 transition API 和详情刷新',
  ).toHaveValue('处理中');
});
```

- [ ] **Step 2: 写宽屏 decision submit_reply 测试**

```ts
async function createWaitingDecision(page: import('@playwright/test').Page, title: string) {
  return page.evaluate(async (cardTitle) => {
    const res = await fetch('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ type: 'decision', status: 'waiting', fields: { title: cardTitle } }),
    });
    if (!res.ok) throw new Error(`创建 waiting decision 失败: ${res.status}`);
    return ((await res.json()) as { card: { id: string } }).card.id;
  }, title);
}

test('阶段 4 宽屏提交回复会执行 submit_reply 流转', async ({ page }) => {
  await page.goto('/');
  await createWaitingDecision(page, '阶段四宽屏决策');
  await page.reload();

  await page.getByRole('button', { name: /阶段四宽屏决策/ }).click();
  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await drawer.getByLabel('正式回复').fill('采用方案 A');
  await drawer.getByRole('button', { name: '提交回复' }).click();

  await expect(
    drawer.getByLabel('Status'),
    '执行 submit_reply 后 decision 状态应变为已解决。若失败：检查 submit_reply transition',
  ).toHaveValue('已解决');
  await expect(drawer.getByDisplayValue('采用方案 A'), '提交回复后回复字段应仍显示已保存内容').toBeVisible();
});
```

该测试依赖默认样例配置中 `reply` 字段 label 为“正式回复”。如果实现时修改了样例配置字段 label，必须同步修改测试选择器和配置文档，不能只在测试里绕开。

- [ ] **Step 3: 写窄屏 task 流转测试**

```ts
test('阶段 4 窄屏可打开详情并执行合法状态流转', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto('/');
  await createTask(page, '阶段四窄屏任务');
  await page.reload();

  await page.getByRole('button', { name: /阶段四窄屏任务/ }).click();
  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await drawer.getByRole('button', { name: '开始处理' }).click();

  await expect(
    drawer.getByLabel('Status'),
    '窄屏执行 transition 后详情状态应更新，不能因抽屉布局丢失核心能力',
  ).toHaveValue('处理中');
});
```

- [ ] **Step 4: 跑阶段 4 E2E**

Run:

```powershell
pnpm test:e2e -- tests/e2e/stage4-controlled-transitions.spec.ts
```

Expected: PASS。

## 8. Task 7: 文档和兼容性收口

**Files:**
- Review: `docs/stages/stage-4-controlled-transitions/design.md`
  - 确认实际实现没有偏离本文档的接口、错误语义和前端交互。
- Review: `docs/stages/stage-4-controlled-transitions/plan.md`
  - 确认执行过程中没有遗留过期步骤。
- Review: `README.md`
  - 确认 README 未描述与阶段 4 冲突的状态修改方式；若发现冲突，新增文档提交修正。

- [ ] **Step 1: 确认阶段 3 action 兼容**

Run:

```powershell
pnpm test -- tests/http/card-actions.test.ts tests/e2e/stage3-agent-decision-loop.spec.ts
```

Expected: PASS。阶段 3 的 action API 不删除，但前端可以不再使用它。

- [ ] **Step 2: 搜索 status 写入入口**

Run:

```powershell
rg "status" src web/src tests/http tests/e2e
```

Expected: 人工确认没有新增通过 PATCH 或 action 写 status 的路径；允许创建卡片时指定初始 status，允许 transition 写 status。

- [ ] **Step 3: 检查新增公开面注释**

Run:

```powershell
rg "export (interface|type|function|class)" src web/src
```

Expected: 本阶段新增或修改涉及的公开类型、接口、函数都有中文 JSDoc。历史未触及公开面不作为本阶段阻塞。

## 9. Task 8: 全量验证

**Files:**
- No source changes unless verification exposes failures.

- [ ] **Step 1: 快速测试**

Run:

```powershell
pnpm test
```

Expected: all tests pass.

- [ ] **Step 2: 类型检查**

Run:

```powershell
pnpm typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 3: Web 构建**

Run:

```powershell
pnpm build:web
```

Expected: build succeeds.

- [ ] **Step 4: E2E**

Run:

```powershell
pnpm test:e2e
```

Expected: all Playwright tests pass.

## 10. 自动化测试覆盖清单

- [ ] S4-T1 statuses 和 transitions 配置可初始化，重复初始化不产生重复数据。
- [ ] S4-T2 `PATCH /cards/:id` 不能修改 `status`。
- [ ] S4-T3 合法 `POST /cards/:id/transition` 返回 200，并把状态改为目标状态。
- [ ] S4-T4 transition 不存在返回 404。
- [ ] S4-T5 当前状态不满足 `fromStatus` 返回 409。
- [ ] S4-T6 全局 transition 能从任意状态执行。
- [ ] S4-T7 transition 可随请求写入允许字段，例如 `reply`。
- [ ] S4-T8 transition 可附带评论，评论被保存。
- [ ] S4-T9 transition 写入 changes，agent 可通过 `/changes?since=` 读到。
- [ ] S4-T10 前端能展示状态，并能触发一个合法流转。
- [ ] S4-T11 transition 请求携带未允许字段时返回 400，且不写入卡片。

## 11. 人工验收指南

1. 启动服务并打开前端。
2. 创建一张 task，确认初始状态为“默认”。
3. 打开 task 详情，点击“开始处理”。
4. 确认状态显示为“处理中”。
5. 点击“完成”，确认状态显示为“完成”。
6. 创建或注入一张 `status=waiting` 的 decision。
7. 打开 decision 详情，填写正式回复，点击“提交回复”。
8. 确认状态显示为“已解决”，回复内容仍可见。
9. 使用 HTTP 请求对非 waiting 卡片执行 `submit_reply`，确认返回 409。
10. 请求 `/changes?since=0`，确认包含 `card.transition.*` 事件。
11. 收窄浏览器到手机宽度，重复打开详情和执行“开始处理”。

## 12. 提交拆分建议

1. `文档: 固化阶段四状态流转方案`
   - 仅包含 `docs/stages/stage-4-controlled-transitions/design.md` 和 `plan.md`。
2. `功能: 增加卡片状态流转服务`
   - 后端 transition 模块、comments 最小写入、route 和 HTTP 测试。
3. `功能: 前端支持状态流转操作`
   - 前端 API、详情抽屉流转控件、状态标签和 E2E。
4. `文档: 补充阶段四公开契约注释`
   - 仅当注释改动能与功能提交清晰拆分时使用；如果注释和新增公开面同文件同语义，也可随功能提交。

## 13. 阶段完成定义

- 后端支持 `POST /cards/:id/transition`。
- transition 执行基于配置校验卡片类型、来源状态、目标状态、可写字段和必填字段。
- 合法 transition 能改变 `cards.status`。
- 非法 transition 有明确 400、404、409 错误语义。
- transition 可写入允许字段，可附带最小评论，可写入 changes。
- `PATCH` 和 action 仍不能修改 `status`。
- 前端 status 只读展示，流转通过明确按钮触发。
- decision 的正式回复通过 `submit_reply` transition 从 `waiting` 进入 `resolved`。
- 本阶段涉及的公开类型、接口、公开函数和公开字段有中文 JSDoc 注释。
- 宽屏和窄屏都能完成核心流转。
- `pnpm test`、`pnpm typecheck`、`pnpm build:web`、`pnpm test:e2e` 通过。

## 14. 自查记录

- 计划覆盖 `docs/ROADMAP.md` 阶段 4 的 S4-F1 到 S4-F9。
- 计划覆盖阶段 4 的 S4-T1 到 S4-T11。
- 计划保留阶段 4 范围外事项：管理界面、角色级流转权限、hook 执行、完整评论功能。
- 计划保留阶段 3 action API 兼容，但前端新体验改走 transition。
- 计划纳入用户确认的中文注释原则：解释契约和空值语义，不复述实现流水账。
