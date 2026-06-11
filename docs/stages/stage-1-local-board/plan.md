# 阶段 1 本地单人可用看板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个本地单人可用看板：人类用户能通过网页创建、查看、筛选、打开详情并编辑 `task`、`decision`、`memo` 卡片。

**Architecture:** 后端继续使用 Hono + `node:sqlite`，以 `createApp(db)` 注入数据库并通过 `/cards` 暴露 JSON API。前端新增 React + Vite SPA，开发期由 Vite 代理 API，构建后由 Hono 托管 `web/dist` 静态资源。端到端验收用 Playwright 从真实浏览器验证阶段 1 主路径。

**Tech Stack:** Node.js >= 22.5、TypeScript ESM、Hono、SQLite `node:sqlite`、zod、React、Vite、Vitest、Playwright、pnpm。

---

## 0. 已确认决策

- 开发必须在新分支或 worktree 上进行，不在 `main` 直接实现。建议分支：`codex/stage1-local-board`。
- 视觉基线已由用户确认，附件为 [`attachments/stage1-board-visual-demo.html`](attachments/stage1-board-visual-demo.html)。
- 阶段 1 前端采用紧凑工作台：左侧筛选、中间卡片列表、右侧详情抽屉、顶部新建入口。
- 阶段 1 接入 Playwright，不等到阶段 8。
- 阶段 1 不做认证、RBAC、changes、评论、hook、状态流转合法性、拖拽看板列。
- `lane` 和 `status` 在前端只做展示、筛选或基础字段处理；`PATCH /cards/{id}` 禁止修改 `status`。

## 1. 文件结构计划

### 后端 API

- Modify: `src/routes/cards.ts`
  - 挂载 `POST /cards`、完整 `GET /cards`、`GET /cards/:id`、`PATCH /cards/:id`。
  - 只保留路由组装和 handler 调用，避免把校验、SQL、序列化全部堆在此文件。
- Create: `src/cards/types.ts`
  - 定义 `CardType`、`CardRow`、`Card`、请求输入类型和常量。
- Create: `src/cards/serialize.ts`
  - 把数据库 `options` JSON 字符串转为数组或 `null`。
- Create: `src/cards/validation.ts`
  - 放 zod schema、分页解析、标题 trim 校验。
- Create: `src/cards/repository.ts`
  - 放 SQL 读写函数，使用参数化语句。
- Create: `src/http/errors.ts`
  - 统一错误体 helper：`badRequest`、`notFound`、`internalError`，格式为 `{ error: { code, message, details? } }`。

### 后端测试

- Modify: `tests/http/cards.test.ts`
  - 覆盖 S1-T1 到 S1-T14。
  - 每个 `expect` 必须带中文辅助信息。
- Create: `tests/http/helpers.ts`
  - 提供 `createTestApp()`、`insertCard()`、`json()` 等测试辅助，减少重复。

### 前端

- Create: `web/package.json`
  - 不单独建 workspace 包；根 `pnpm` 通过脚本调用 `vite --config web/vite.config.ts`。
- Create: `web/index.html`
  - React 挂载点。
- Create: `web/vite.config.ts`
  - 配置 React 插件、dev server 代理 `/api` 到 `http://127.0.0.1:3000`、构建输出 `web/dist`。
- Create: `web/tsconfig.json`
  - 前端 TypeScript 配置。
- Create: `web/src/main.tsx`
  - React 入口。
- Create: `web/src/App.tsx`
  - 页面状态组合：列表、筛选、新建、详情抽屉。
- Create: `web/src/api/cards.ts`
  - 封装 `listCards`、`createCard`、`getCard`、`updateCard`。
- Create: `web/src/types.ts`
  - 前端 Card 类型。
- Create: `web/src/components/Topbar.tsx`
- Create: `web/src/components/SidebarFilters.tsx`
- Create: `web/src/components/CardList.tsx`
- Create: `web/src/components/CardDrawer.tsx`
- Create: `web/src/components/NewCardDialog.tsx`
- Create: `web/src/components/ErrorMessage.tsx`
- Create: `web/src/styles.css`
  - 从附件视觉 demo 收敛为实际 CSS，不引入 UI 组件库。

### 前端静态托管

- Modify: `src/app.ts`
  - 在 API 路由之后增加静态资源托管和 SPA fallback。
- Create: `src/http/static.ts`
  - 检测 `web/dist` 是否存在；存在时托管静态文件，不存在时 `/` 返回开发提示或 404 JSON。

### Playwright

- Create: `playwright.config.ts`
  - webServer 启动构建后的 Hono 服务，使用临时 `DB_PATH`。
- Create: `tests/e2e/stage1-board.spec.ts`
  - 覆盖网页建卡、看卡、打开抽屉、编辑、筛选、错误提示。

### 脚本与文档

- Modify: `package.json`
  - 增加 React/Vite/Playwright 依赖和脚本。
  - 保留现有 `pnpm test` 快速 Vitest 门禁。
- Modify: `README.md`
  - 更新阶段 1 启动、前端访问、API 示例和验收路径。
- Preserve: `docs/阶段1-本地单人可用看板/attachments/stage1-board-visual-demo.html`
  - 仅作为本地计划附件，不进入提交，因 `docs/` 已被 `.gitignore` 忽略。

## 2. 数据和接口设计

### 2.1 Card 响应形状

所有成功响应中的卡片使用同一形状：

```ts
interface Card {
  id: string;
  type: 'task' | 'decision' | 'memo';
  title: string;
  body: string | null;
  options: string[] | null;
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
```

### 2.2 错误体

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数无效",
    "details": {
      "field": "title",
      "reason": "标题不能为空"
    }
  }
}
```

建议错误码：

- `VALIDATION_ERROR`：请求体、路径参数、查询参数无效。
- `CARD_NOT_FOUND`：卡片不存在。
- `STATUS_PATCH_FORBIDDEN`：`PATCH /cards/{id}` 尝试改 `status`。
- `INTERNAL_ERROR`：未预期错误。

### 2.3 创建卡片

`POST /cards` 请求体：

```json
{
  "type": "decision",
  "title": "阶段 1 前端详情用什么形态",
  "body": "需要确认详情交互。",
  "options": ["右侧抽屉", "单独详情页"],
  "status": "default",
  "lane": "default",
  "priority": 1,
  "assignee": "human"
}
```

规则：

- `type` 必填，只允许 `task`、`decision`、`memo`。
- `title` 必填，trim 后不能为空，落库使用 trim 后的标题。
- `status` 可选，缺省为 `default`；显式传入则原样保存。
- `created_by` 从 `X-Actor` header 读取；缺省为 `human`。
- `priority` 缺省为 0。
- `options` 仅 `decision` 持久化；非 `decision` 一律保存为 `null`。
- 成功返回 201 和完整卡片。

### 2.4 列表查询

`GET /cards` 支持：

- `type`
- `status`
- `lane`
- `assignee`
- `limit`
- `offset`
- `all=true`

规则：

- 多个过滤条件为 AND。
- 默认 `limit=50`、`offset=0`。
- 普通 `limit` 最大为 500。
- `all=true` 忽略 `limit` 和 `offset`。
- 非法分页参数返回 400，`details.field` 指出 `limit` 或 `offset`。
- 排序固定为 `created_at DESC, id DESC`。
- 返回 `{ cards, total }`，`total` 是过滤后的总数。

### 2.5 单卡读取

`GET /cards/{id}`：

- 存在返回 200 和完整卡片。
- 不存在返回 404，错误码 `CARD_NOT_FOUND`。

### 2.6 卡片编辑

`PATCH /cards/{id}` 可修改：

- `title`
- `body`
- `priority`
- `lane`
- `assignee`

规则：

- 请求体包含 `status` 时返回 400，错误码 `STATUS_PATCH_FORBIDDEN`，且不落库。
- `title` 使用与创建相同的 trim 非空校验。
- 成功后 `updated_at = Date.now()`。
- 成功返回 200 和完整卡片。
- 卡片不存在返回 404。

## 3. 任务拆分

### Task 1: 建立阶段 1 工作分支并验证基线

**Files:**
- Read: `AGENTS.md`
- Read: `开发规范.md`
- Read: `docs/路线图.md`
- Read: `docs/阶段1-本地单人可用看板/实现计划.md`

- [ ] **Step 1: 确认当前分支和工作区**

Run:

```powershell
git status --short --branch
```

Expected:

```text
## main
```

允许看到 `?? docs/` 或 `?? 代理执行笔记/`，这些是本地忽略资料，不纳入功能提交。

- [ ] **Step 2: 新建开发分支**

Run:

```powershell
git switch -c codex/stage1-local-board
```

Expected:

```text
Switched to a new branch 'codex/stage1-local-board'
```

- [ ] **Step 3: 跑现有快速测试**

Run:

```powershell
pnpm test
```

Expected: Vitest 通过，现有 `/health` 和只读 `/cards` 测试为绿。

- [ ] **Step 4: 跑类型检查**

Run:

```powershell
pnpm typecheck
```

Expected: `tsc --noEmit` 退出 0。

### Task 2: 写卡片 API 的失败测试清单

**Files:**
- Modify: `tests/http/cards.test.ts`
- Create: `tests/http/helpers.ts`

- [ ] **Step 1: 新增 HTTP 测试 helper**

Create `tests/http/helpers.ts`:

```ts
import type { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../src/app.ts';
import { createDb } from '../../src/db/index.ts';

export function createTestApp() {
  const db = createDb(':memory:');
  const app = createApp(db);
  return { app, db };
}

export async function readJson(res: Response) {
  return (await res.json()) as any;
}

export function insertCard(db: DatabaseSync, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  const card = {
    id: 'card_1',
    type: 'decision',
    title: '推送用 SSE 还是 WebSocket?',
    body: '需拍板',
    options: JSON.stringify(['SSE', 'WebSocket']),
    status: 'default',
    lane: null,
    priority: 0,
    created_by: 'agent',
    assignee: null,
    reply: null,
    replied_by: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };

  db.prepare(
    `INSERT INTO cards (
      id, type, title, body, options, status, lane, priority,
      created_by, assignee, reply, replied_by, created_at, updated_at
    ) VALUES (
      @id, @type, @title, @body, @options, @status, @lane, @priority,
      @created_by, @assignee, @reply, @replied_by, @created_at, @updated_at
    )`,
  ).run(card as any);

  return card;
}
```

- [ ] **Step 2: 替换 `tests/http/cards.test.ts` 的本地 helper 引用**

Modify imports:

```ts
import { describe, it, expect } from 'vitest';
import { createTestApp, insertCard, readJson } from './helpers.ts';
```

删除文件内旧的 `insertCard`、`createDb`、`createApp` imports。

- [ ] **Step 3: 为 S1-T1 到 S1-T14 写失败测试**

在 `tests/http/cards.test.ts` 中追加测试。每个 `expect` 必须保持中文辅助信息。测试用例名称按行为写，例如：

```ts
it('POST /cards 创建 task 成功返回 201、完整卡片和默认 status', async () => {
  const { app } = createTestApp();

  const res = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'task', title: '补齐卡片 API', body: '阶段 1 后端能力' }),
  });

  const body = await readJson(res);
  expect(
    res.status,
    '创建合法 task 应返回 201。若失败：检查 POST /cards 路由是否注册，以及 zod 校验是否接受 task',
  ).toBe(201);
  expect(
    body.card.status,
    '未显式传 status 时应默认为 default。若失败：检查 create card 的默认值填充逻辑',
  ).toBe('default');
  expect(
    body.card.title,
    '返回标题应为请求标题。若失败：检查 title trim 与 INSERT/serialize 字段映射',
  ).toBe('补齐卡片 API');
});
```

同文件补齐以下真实测试，每个测试至少包含列出的断言。不要提交缺少断言的测试，因为阶段 1 要落地这些能力。

- `POST /cards 创建 decision 时保存 options，读取时 options 为数组`
  - 断言响应状态为 201。
  - 断言响应 `card.type` 为 `decision`。
  - 断言响应 `card.options` 等于 `['右侧抽屉', '单独详情页']`。
  - 再请求 `GET /cards/{id}`，断言读取结果的 `card.options` 仍为数组。
- `POST /cards 创建 memo 成功且忽略非 decision 的 options`
  - 断言响应状态为 201。
  - 断言响应 `card.type` 为 `memo`。
  - 断言响应 `card.options` 为 `null`。
- `POST /cards 缺少 type、非法 type、缺少 title、纯空白 title 均返回 400 并指出字段`
  - 对四个非法请求分别发起 `POST /cards`。
  - 每个响应都断言状态为 400。
  - 每个响应都断言 `error.code` 为 `VALIDATION_ERROR`。
  - 每个响应都断言 `error.details.field` 是对应字段。
- `POST /cards 使用 X-Actor 写 created_by，未传时为 human`
  - 带 `X-Actor: codex` 创建卡片，断言 `created_by` 为 `codex`。
  - 不带 `X-Actor` 创建卡片，断言 `created_by` 为 `human`。
- `GET /cards 支持 type、status、lane、assignee 过滤且多个条件为 AND`
  - 插入至少 4 张字段不同的卡。
  - 请求 `GET /cards?type=task&status=default&lane=work&assignee=human`。
  - 断言只返回同时满足四个条件的卡。
  - 断言 `total` 为过滤后总数。
- `GET /cards 默认分页 limit=50 offset=0，total 为过滤后的总数`
  - 插入 55 张卡。
  - 请求 `GET /cards`。
  - 断言 `cards.length` 为 50。
  - 断言 `total` 为 55。
- `GET /cards?all=true 返回全部匹配卡片并忽略 limit 与 offset`
  - 插入 3 张 `task` 和 2 张 `memo`。
  - 请求 `GET /cards?type=task&all=true&limit=1&offset=2`。
  - 断言返回 3 张 `task`。
  - 断言 `total` 为 3。
- `GET /cards 非法 limit 或 offset 返回 400 且 details 指出字段和原因`
  - 请求 `GET /cards?limit=0`，断言 `details.field` 为 `limit`。
  - 请求 `GET /cards?limit=501`，断言 `details.field` 为 `limit`。
  - 请求 `GET /cards?offset=-1`，断言 `details.field` 为 `offset`。
  - 每个响应都断言 `details.reason` 是非空字符串。
- `GET /cards 按 created_at DESC, id DESC 稳定排序`
  - 插入 created_at 不同的卡，断言新时间在前。
  - 插入 created_at 相同但 id 不同的卡，断言 id 倒序。
- `GET /cards/:id 存在返回 200，不存在返回 404`
  - 插入一张卡，读取其 id，断言状态 200 和 id 一致。
  - 读取不存在 id，断言状态 404 和 `error.code` 为 `CARD_NOT_FOUND`。
- `PATCH /cards/:id 可更新允许字段，更新后返回完整卡片`
  - 插入一张卡。
  - PATCH `title/body/priority/lane/assignee`。
  - 断言响应状态 200。
  - 断言返回卡片字段均已更新。
  - 断言 `updated_at >=` 旧值。
- `PATCH /cards/:id 传入 status 返回 400 且不落库`
  - 插入一张 `status=default` 的卡。
  - PATCH `{ "status": "done" }`。
  - 断言响应状态 400。
  - 断言 `error.code` 为 `STATUS_PATCH_FORBIDDEN`。
  - 再读取该卡，断言 `status` 仍为 `default`。
- `PATCH /cards/:id 不存在返回 404`
  - 请求不存在 id。
  - 断言状态 404。
  - 断言 `error.code` 为 `CARD_NOT_FOUND`。

- [ ] **Step 4: 运行卡片测试确认失败**

Run:

```powershell
pnpm vitest run tests/http/cards.test.ts
```

Expected: 新增测试因 `POST /cards`、`GET /cards/:id`、`PATCH /cards/:id` 未实现而失败。

### Task 3: 实现后端错误体、校验和序列化

**Files:**
- Create: `src/http/errors.ts`
- Create: `src/cards/types.ts`
- Create: `src/cards/serialize.ts`
- Create: `src/cards/validation.ts`

- [ ] **Step 1: 创建统一错误 helper**

Create `src/http/errors.ts`:

```ts
import type { Context } from 'hono';

export interface ErrorDetails {
  field?: string;
  reason?: string;
  [key: string]: unknown;
}

export function errorBody(code: string, message: string, details?: ErrorDetails) {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

export function badRequest(c: Context, code: string, message: string, details?: ErrorDetails) {
  return c.json(errorBody(code, message, details), 400);
}

export function notFound(c: Context, code = 'CARD_NOT_FOUND', message = '卡片不存在') {
  return c.json(errorBody(code, message), 404);
}
```

- [ ] **Step 2: 创建卡片类型和常量**

Create `src/cards/types.ts`:

```ts
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
```

- [ ] **Step 3: 创建序列化函数**

Create `src/cards/serialize.ts`:

```ts
import type { Card, CardRow } from './types.ts';

export function serializeCard(row: CardRow): Card {
  return {
    ...row,
    options: row.options ? (JSON.parse(row.options) as string[]) : null,
  };
}
```

- [ ] **Step 4: 创建 zod 校验和分页解析**

Create `src/cards/validation.ts`:

```ts
import { z } from 'zod';
import { CARD_TYPES, DEFAULT_LIMIT, MAX_LIMIT } from './types.ts';

const titleSchema = z
  .string({ required_error: '标题不能为空' })
  .transform((value) => value.trim())
  .pipe(z.string().min(1, '标题不能为空'));

export const createCardSchema = z.object({
  type: z.enum(CARD_TYPES, { required_error: 'type 不能为空' }),
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
```

- [ ] **Step 5: 运行类型检查确认新文件无类型错误**

Run:

```powershell
pnpm typecheck
```

Expected: 可能仍因未使用文件而通过；若失败，修正 import/export 类型问题。

### Task 4: 实现卡片 repository

**Files:**
- Create: `src/cards/repository.ts`

- [ ] **Step 1: 创建 repository 文件**

Create `src/cards/repository.ts`:

```ts
import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { DEFAULT_ACTOR, DEFAULT_STATUS, type CardRow } from './types.ts';

export interface CreateCardInput {
  type: 'task' | 'decision' | 'memo';
  title: string;
  body?: string | null;
  options?: string[];
  status?: string;
  lane?: string | null;
  priority?: number;
  assignee?: string | null;
  actor?: string;
}

export interface ListCardsInput {
  type?: string;
  status?: string;
  lane?: string;
  assignee?: string;
  all: boolean;
  limit: number;
  offset: number;
}

export interface UpdateCardInput {
  title?: string;
  body?: string | null;
  priority?: number;
  lane?: string | null;
  assignee?: string | null;
}

export function createCard(db: DatabaseSync, input: CreateCardInput): CardRow {
  const now = Date.now();
  const card = {
    id: randomUUID(),
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    options: input.type === 'decision' && input.options ? JSON.stringify(input.options) : null,
    status: input.status ?? DEFAULT_STATUS,
    lane: input.lane ?? null,
    priority: input.priority ?? 0,
    created_by: input.actor ?? DEFAULT_ACTOR,
    assignee: input.assignee ?? null,
    reply: null,
    replied_by: null,
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `INSERT INTO cards (
      id, type, title, body, options, status, lane, priority,
      created_by, assignee, reply, replied_by, created_at, updated_at
    ) VALUES (
      @id, @type, @title, @body, @options, @status, @lane, @priority,
      @created_by, @assignee, @reply, @replied_by, @created_at, @updated_at
    )`,
  ).run(card);

  return card as CardRow;
}

function listWhere(input: Pick<ListCardsInput, 'type' | 'status' | 'lane' | 'assignee'>) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  for (const field of ['type', 'status', 'lane', 'assignee'] as const) {
    const value = input[field];
    if (value !== undefined) {
      clauses.push(`${field} = @${field}`);
      params[field] = value;
    }
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export function listCards(db: DatabaseSync, input: ListCardsInput) {
  const { whereSql, params } = listWhere(input);
  const total = db.prepare(`SELECT COUNT(*) AS count FROM cards ${whereSql}`).get(params) as {
    count: number;
  };

  const limitSql = input.all ? '' : ' LIMIT @limit OFFSET @offset';
  const rows = db
    .prepare(`SELECT * FROM cards ${whereSql} ORDER BY created_at DESC, id DESC${limitSql}`)
    .all({ ...params, limit: input.limit, offset: input.offset }) as unknown as CardRow[];

  return { rows, total: total.count };
}

export function getCard(db: DatabaseSync, id: string) {
  return db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as CardRow | undefined;
}

export function updateCard(db: DatabaseSync, id: string, input: UpdateCardInput) {
  const current = getCard(db, id);
  if (!current) return undefined;

  const next = {
    title: input.title ?? current.title,
    body: input.body ?? current.body,
    priority: input.priority ?? current.priority,
    lane: input.lane ?? current.lane,
    assignee: input.assignee ?? current.assignee,
    updated_at: Date.now(),
    id,
  };

  db.prepare(
    `UPDATE cards
     SET title = @title,
         body = @body,
         priority = @priority,
         lane = @lane,
         assignee = @assignee,
         updated_at = @updated_at
     WHERE id = @id`,
  ).run(next);

  return getCard(db, id);
}
```

- [ ] **Step 2: 运行类型检查**

Run:

```powershell
pnpm typecheck
```

Expected: repository 类型检查通过。

### Task 5: 挂载卡片 API handler

**Files:**
- Modify: `src/routes/cards.ts`

- [ ] **Step 1: 重写 cards route**

Replace `src/routes/cards.ts` with:

```ts
import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';
import { badRequest, notFound } from '../http/errors.ts';
import { createCard, getCard, listCards, updateCard } from '../cards/repository.ts';
import { serializeCard } from '../cards/serialize.ts';
import {
  createCardSchema,
  parsePagination,
  updateCardSchema,
  zodFieldError,
} from '../cards/validation.ts';

export const cards = new Hono<AppEnv>();

cards.get('/', (c) => {
  const pagination = parsePagination(new URL(c.req.url));
  if (!pagination.ok) {
    return badRequest(c, 'VALIDATION_ERROR', '分页参数无效', pagination.error);
  }

  const db = c.get('db');
  const { rows, total } = listCards(db, {
    type: c.req.query('type'),
    status: c.req.query('status'),
    lane: c.req.query('lane'),
    assignee: c.req.query('assignee'),
    ...pagination.value,
  });

  return c.json({ cards: rows.map(serializeCard), total });
});

cards.post('/', async (c) => {
  const parsed = createCardSchema.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) {
    return badRequest(c, 'VALIDATION_ERROR', '请求体无效', zodFieldError(parsed.error));
  }

  const row = createCard(c.get('db'), {
    ...parsed.data,
    actor: c.req.header('X-Actor') ?? undefined,
  });

  return c.json({ card: serializeCard(row) }, 201);
});

cards.get('/:id', (c) => {
  const row = getCard(c.get('db'), c.req.param('id'));
  if (!row) return notFound(c);
  return c.json({ card: serializeCard(row) });
});

cards.patch('/:id', async (c) => {
  const parsed = updateCardSchema.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) {
    const details = zodFieldError(parsed.error);
    return badRequest(
      c,
      details.field === 'status' ? 'STATUS_PATCH_FORBIDDEN' : 'VALIDATION_ERROR',
      details.reason,
      details,
    );
  }

  const row = updateCard(c.get('db'), c.req.param('id'), parsed.data);
  if (!row) return notFound(c);
  return c.json({ card: serializeCard(row) });
});
```

- [ ] **Step 2: 跑卡片 HTTP 测试**

Run:

```powershell
pnpm vitest run tests/http/cards.test.ts
```

Expected: S1-T1 到 S1-T14 通过。若失败，优先修正实现，不弱化测试。

- [ ] **Step 3: 跑全部快速测试和类型检查**

Run:

```powershell
pnpm test
pnpm typecheck
```

Expected: 全部通过。

- [ ] **Step 4: 提交后端 API**

Run:

```powershell
git add src/cards src/http src/routes/cards.ts tests/http/cards.test.ts tests/http/helpers.ts
git commit -m "功能: 完成阶段一卡片 API

意图：让本地看板具备创建、读取、过滤分页和基础编辑卡片的后端能力。

主要修改：
- 增加卡片校验、序列化、repository 和统一错误体
- 实现 POST/GET/GET by id/PATCH cards 接口
- 补齐阶段一 HTTP 行为测试"
```

Expected: commit-msg hook 和 pre-commit hook 通过。

### Task 6: 接入 React + Vite 前端工程

**Files:**
- Modify: `package.json`
- Create: `web/package.json`
- Create: `web/index.html`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/styles.css`

- [ ] **Step 1: 安装前端依赖**

Run:

```powershell
pnpm add react react-dom @hono/node-server
pnpm add -D @vitejs/plugin-react vite @types/react @types/react-dom
```

Expected: `package.json` 和 `pnpm-lock.yaml` 更新。`@hono/node-server` 已存在时 pnpm 不应重复添加版本。

- [ ] **Step 2: 增加根脚本**

Modify `package.json` scripts:

```json
{
  "dev": "node --experimental-sqlite --no-warnings --import tsx --watch src/index.ts",
  "dev:web": "vite --config web/vite.config.ts",
  "build:web": "vite build --config web/vite.config.ts",
  "preview:web": "vite preview --config web/vite.config.ts",
  "start": "node --experimental-sqlite --no-warnings --import tsx src/index.ts",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit && tsc --noEmit -p web/tsconfig.json",
  "prepare": "husky && git config merge.ff false"
}
```

- [ ] **Step 3: 创建 Vite 配置**

Create `web/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'web',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
```

- [ ] **Step 4: 创建前端入口文件**

Create `web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>aizen-majordomo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `web/tsconfig.json`:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

Create `web/src/main.tsx`:

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 5: 创建最小 App 骨架**

Create `web/src/App.tsx`:

```tsx
export function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <strong>aizen-majordomo</strong>
        <button type="button">新建卡片</button>
      </header>
      <main className="workspace">
        <aside className="sidebar">筛选</aside>
        <section className="main-panel">卡片列表</section>
        <aside className="drawer">详情</aside>
      </main>
    </div>
  );
}
```

Create `web/src/styles.css` with the shell CSS copied and simplified from the confirmed attachment:

```css
:root {
  color-scheme: light;
  --bg: #f4f6f8;
  --panel: #ffffff;
  --line: #d9dee5;
  --text: #17202a;
  --muted: #667385;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    "Microsoft YaHei", sans-serif;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  letter-spacing: 0;
}

button,
input,
textarea,
select {
  font: inherit;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: 52px 1fr;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  background: var(--panel);
  border-bottom: 1px solid var(--line);
}

.workspace {
  min-height: 0;
  display: grid;
  grid-template-columns: 230px minmax(520px, 1fr) 430px;
}

.sidebar,
.main-panel,
.drawer {
  min-height: 0;
  overflow: auto;
}

.sidebar {
  border-right: 1px solid var(--line);
  padding: 16px;
}

.main-panel {
  padding: 16px 18px;
}

.drawer {
  border-left: 1px solid var(--line);
  background: var(--panel);
  padding: 16px 18px;
}
```

- [ ] **Step 6: 验证前端可构建**

Run:

```powershell
pnpm build:web
pnpm typecheck
```

Expected: Vite build 生成 `web/dist`，类型检查通过。

### Task 7: 实现前端 API client 和真实数据渲染

**Files:**
- Create: `web/src/types.ts`
- Create: `web/src/api/cards.ts`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: 创建前端类型**

Create `web/src/types.ts`:

```ts
export type CardType = 'task' | 'decision' | 'memo';

export interface Card {
  id: string;
  type: CardType;
  title: string;
  body: string | null;
  options: string[] | null;
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

export interface CardFilters {
  type?: CardType | '';
  status?: string;
  lane?: string;
  assignee?: string;
  all?: boolean;
}
```

- [ ] **Step 2: 创建 API client**

Create `web/src/api/cards.ts`:

```ts
import type { Card, CardFilters, CardType } from '../types.ts';

const API_BASE = import.meta.env.DEV ? '/api' : '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const message = body?.error?.message ?? '请求失败';
    throw new Error(message);
  }
  return body as T;
}

export async function listCards(filters: CardFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return request<{ cards: Card[]; total: number }>(`/cards${query ? `?${query}` : ''}`);
}

export async function getCard(id: string) {
  return request<{ card: Card }>(`/cards/${id}`);
}

export async function createCard(input: {
  type: CardType;
  title: string;
  body?: string;
  options?: string[];
  priority?: number;
  lane?: string;
  assignee?: string;
}) {
  return request<{ card: Card }>('/cards', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCard(id: string, input: Partial<Pick<Card, 'title' | 'body' | 'priority' | 'lane' | 'assignee'>>) {
  return request<{ card: Card }>(`/cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
```

- [ ] **Step 3: 在 App 中加载列表**

Modify `web/src/App.tsx` to use state:

```tsx
import { useEffect, useState } from 'react';
import { listCards } from './api/cards.ts';
import type { Card, CardFilters } from './types.ts';

export function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<CardFilters>({});
  const [selected, setSelected] = useState<Card | null>(null);
  const [error, setError] = useState('');

  async function refresh(nextFilters = filters) {
    try {
      setError('');
      const result = await listCards({ ...nextFilters, all: true });
      setCards(result.cards);
      setTotal(result.total);
      setSelected((current) => current && result.cards.find((card) => card.id === current.id) ? current : result.cards[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载卡片失败');
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <strong>aizen-majordomo</strong>
        <button type="button">新建卡片</button>
      </header>
      {error && <div className="global-error">{error}</div>}
      <main className="workspace">
        <aside className="sidebar">筛选</aside>
        <section className="main-panel">
          <h1>本地单人看板</h1>
          <p>{total} 张卡片</p>
          {cards.length === 0 ? (
            <p>还没有卡片。创建第一张 task、decision 或 memo。</p>
          ) : (
            cards.map((card) => (
              <button className="card-row" key={card.id} type="button" onClick={() => setSelected(card)}>
                <span>{card.type}</span>
                <strong>{card.title}</strong>
                <span>{card.assignee ?? '未分配'}</span>
              </button>
            ))
          )}
        </section>
        <aside className="drawer">{selected ? selected.title : '选择一张卡片'}</aside>
      </main>
    </div>
  );
}
```

- [ ] **Step 4: 验证构建**

Run:

```powershell
pnpm build:web
pnpm typecheck
```

Expected: 前端构建和类型检查通过。

### Task 8: 实现前端组件和已确认视觉

**Files:**
- Create: `web/src/components/Topbar.tsx`
- Create: `web/src/components/SidebarFilters.tsx`
- Create: `web/src/components/CardList.tsx`
- Create: `web/src/components/CardDrawer.tsx`
- Create: `web/src/components/NewCardDialog.tsx`
- Create: `web/src/components/ErrorMessage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: 创建错误组件**

Create `web/src/components/ErrorMessage.tsx`:

```tsx
export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return <div className="error-box">{message}</div>;
}
```

- [ ] **Step 2: 创建卡片列表组件**

Create `web/src/components/CardList.tsx`:

```tsx
import type { Card } from '../types.ts';

export function CardList({
  cards,
  selectedId,
  onSelect,
}: {
  cards: Card[];
  selectedId?: string;
  onSelect: (card: Card) => void;
}) {
  if (cards.length === 0) {
    return <div className="empty-state">还没有卡片。创建第一张 task、decision 或 memo。</div>;
  }

  return (
    <section className="card-list" aria-label="卡片列表">
      {cards.map((card) => (
        <button
          className={`card-row ${selectedId === card.id ? 'selected' : ''}`}
          key={card.id}
          type="button"
          onClick={() => onSelect(card)}
        >
          <span className={`badge ${card.type}`}>{card.type}</span>
          <span className="card-main">
            <strong>{card.title}</strong>
            <small>{card.body || '无正文'}</small>
          </span>
          <span>P{card.priority}</span>
          <span>{card.assignee ?? '未分配'}</span>
        </button>
      ))}
    </section>
  );
}
```

- [ ] **Step 3: 创建筛选组件**

Create `web/src/components/SidebarFilters.tsx`:

```tsx
import type { CardFilters, CardType } from '../types.ts';

export function SidebarFilters({
  filters,
  onChange,
}: {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
}) {
  function setType(type: CardType | '') {
    onChange({ ...filters, type });
  }

  return (
    <aside className="sidebar" aria-label="筛选">
      <section>
        <h2>类型</h2>
        <button type="button" className={!filters.type ? 'active' : ''} onClick={() => setType('')}>
          全部卡片
        </button>
        <button type="button" className={filters.type === 'task' ? 'active' : ''} onClick={() => setType('task')}>
          Task
        </button>
        <button type="button" className={filters.type === 'decision' ? 'active' : ''} onClick={() => setType('decision')}>
          Decision
        </button>
        <button type="button" className={filters.type === 'memo' ? 'active' : ''} onClick={() => setType('memo')}>
          Memo
        </button>
      </section>
    </aside>
  );
}
```

- [ ] **Step 4: 创建详情抽屉组件**

Create `web/src/components/CardDrawer.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Card } from '../types.ts';
import { ErrorMessage } from './ErrorMessage.tsx';

export function CardDrawer({
  card,
  onSave,
}: {
  card: Card | null;
  onSave: (input: Partial<Pick<Card, 'title' | 'body' | 'priority' | 'lane' | 'assignee'>>) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState(0);
  const [lane, setLane] = useState('');
  const [assignee, setAssignee] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(card?.title ?? '');
    setBody(card?.body ?? '');
    setPriority(card?.priority ?? 0);
    setLane(card?.lane ?? '');
    setAssignee(card?.assignee ?? '');
    setError('');
  }, [card]);

  if (!card) return <aside className="drawer">选择一张卡片查看详情。</aside>;

  async function submit() {
    try {
      setError('');
      await onSave({
        title,
        body,
        priority,
        lane: lane || null,
        assignee: assignee || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  return (
    <aside className="drawer" aria-label="卡片详情">
      <div className="drawer-head">
        <span className={`badge ${card.type}`}>{card.type}</span>
        <h2>{card.title}</h2>
      </div>
      <div className="drawer-body">
        <ErrorMessage message={error} />
        <label>
          标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          正文
          <textarea value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        <label>
          优先级
          <input type="number" value={priority} onChange={(event) => setPriority(Number(event.target.value))} />
        </label>
        <label>
          Lane
          <input value={lane} onChange={(event) => setLane(event.target.value)} />
        </label>
        <label>
          负责人
          <input value={assignee} onChange={(event) => setAssignee(event.target.value)} />
        </label>
        <label>
          Status
          <input value={card.status} disabled />
        </label>
        {card.options && (
          <div>
            <strong>Decision options</strong>
            {card.options.map((option) => (
              <div className="option-row" key={option}>
                {option}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="drawer-foot">
        <button type="button" onClick={submit}>
          保存
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: 创建新建卡片组件**

Create `web/src/components/NewCardDialog.tsx`:

```tsx
import { useState } from 'react';
import type { CardType } from '../types.ts';
import { ErrorMessage } from './ErrorMessage.tsx';

export function NewCardDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { type: CardType; title: string; body: string; options?: string[] }) => Promise<void>;
}) {
  const [type, setType] = useState<CardType>('task');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  async function submit() {
    try {
      setError('');
      await onCreate({
        type,
        title,
        body,
        options: type === 'decision' ? optionsText.split('\n').map((item) => item.trim()).filter(Boolean) : undefined,
      });
      setTitle('');
      setBody('');
      setOptionsText('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  }

  return (
    <div className="dialog-backdrop">
      <section className="dialog" aria-label="新建卡片">
        <h2>新建卡片</h2>
        <ErrorMessage message={error} />
        <label>
          类型
          <select value={type} onChange={(event) => setType(event.target.value as CardType)}>
            <option value="task">task</option>
            <option value="decision">decision</option>
            <option value="memo">memo</option>
          </select>
        </label>
        <label>
          标题
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          正文
          <textarea value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        {type === 'decision' && (
          <label>
            Options，每行一项
            <textarea value={optionsText} onChange={(event) => setOptionsText(event.target.value)} />
          </label>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" onClick={submit}>
            创建
          </button>
        </footer>
      </section>
    </div>
  );
}
```

- [ ] **Step 6: App 组合组件并应用视觉 CSS**

Modify `web/src/App.tsx` to use `SidebarFilters`、`CardList`、`CardDrawer`、`NewCardDialog`、API client. `styles.css` 按附件视觉稿补齐类名：`.topbar`、`.workspace`、`.sidebar`、`.main-panel`、`.card-list`、`.card-row`、`.drawer`、`.drawer-head`、`.drawer-body`、`.drawer-foot`、`.badge`、`.dialog`、`.error-box`、`.empty-state`。

- [ ] **Step 7: 人工预览视觉**

Run two terminals:

```powershell
pnpm dev
pnpm dev:web
```

Open:

```text
http://127.0.0.1:5173
```

Expected: 页面视觉贴近附件 demo：左侧筛选、中间紧凑列表、右侧详情抽屉。空库时显示空状态。

### Task 9: Hono 托管前端构建产物

**Files:**
- Create: `src/http/static.ts`
- Modify: `src/app.ts`

- [ ] **Step 1: 创建静态托管 helper**

Create `src/http/static.ts`:

```ts
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Hono } from 'hono';
import type { AppEnv } from '../types.ts';

const distDir = join(process.cwd(), 'web', 'dist');

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function assetResponse(path: string) {
  const file = readFileSync(path);
  return new Response(file, {
    headers: {
      'content-type': contentTypes[extname(path)] ?? 'application/octet-stream',
    },
  });
}

export function mountStatic(app: Hono<AppEnv>) {
  app.get('/assets/*', (c) => {
    const relative = c.req.path.replace(/^\/assets\//, '');
    const path = join(distDir, 'assets', relative);
    if (!existsSync(path) || !statSync(path).isFile()) return c.notFound();
    return assetResponse(path);
  });

  app.get('/', () => {
    const index = join(distDir, 'index.html');
    if (!existsSync(index)) {
      return new Response('前端尚未构建。请先运行 pnpm build:web。', { status: 404 });
    }
    return assetResponse(index);
  });
}
```

- [ ] **Step 2: 在 app 中挂载静态资源**

Modify `src/app.ts`:

```ts
import { mountStatic } from './http/static.ts';
```

在 `app.route('/cards', cards);` 后追加：

```ts
mountStatic(app);
```

- [ ] **Step 3: 验证单服务模式**

Run:

```powershell
pnpm build:web
pnpm start
```

Open:

```text
http://127.0.0.1:3000
```

Expected: Hono 返回 React 页面；页面请求 `/cards` 能读取真实 SQLite 数据。

### Task 10: 接入 Playwright 阶段 1 验收

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Create: `tests/e2e/stage1-board.spec.ts`

- [ ] **Step 1: 安装 Playwright**

Run:

```powershell
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

Expected: `package.json`、`pnpm-lock.yaml` 更新，Chromium 安装成功。

- [ ] **Step 2: 创建 Playwright 配置**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm build:web && $env:DB_PATH = ".\\\\data\\\\e2e-stage1.db"; pnpm start',
    url: 'http://127.0.0.1:3000/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
```

- [ ] **Step 3: 创建 E2E 测试**

Create `tests/e2e/stage1-board.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('阶段 1 页面可创建、查看、编辑卡片并显示错误', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByText('还没有卡片'),
    '空库首页应显示可理解空状态。若失败：检查 Hono 是否托管前端，以及 React 是否成功请求 /cards',
  ).toBeVisible();

  await page.getByRole('button', { name: '新建卡片' }).click();
  await page.getByLabel('标题').fill('第一张 task');
  await page.getByLabel('正文').fill('通过浏览器记录真实事项');
  await page.getByRole('button', { name: '创建' }).click();

  await expect(
    page.getByText('第一张 task'),
    '创建 task 后列表应出现该标题。若失败：检查 POST /cards 或列表刷新逻辑',
  ).toBeVisible();

  await page.getByText('第一张 task').click();
  await page.getByLabel('负责人').fill('human');
  await page.getByLabel('优先级').fill('1');
  await page.getByRole('button', { name: '保存' }).click();

  await expect(
    page.getByText('human'),
    '保存负责人后列表或详情应显示 human。若失败：检查 PATCH /cards/:id 和前端刷新逻辑',
  ).toBeVisible();

  await page.getByRole('button', { name: '新建卡片' }).click();
  await page.getByRole('button', { name: '创建' }).click();

  await expect(
    page.getByText('标题不能为空'),
    '空标题创建应显示后端错误。若失败：检查错误体解析和表单错误展示位置',
  ).toBeVisible();
});
```

如果 Playwright 的标签定位因组件结构不稳定而失败，实现时给输入控件补充明确 `aria-label`，不要把测试改成脆弱的 CSS 位置选择器。

- [ ] **Step 4: 跑 E2E**

Run:

```powershell
pnpm test:e2e
```

Expected: Chromium 中完成空状态、创建、详情抽屉编辑、错误提示路径。

### Task 11: 文档更新与人工验收

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README 当前状态**

把 README 顶部状态从“脚手架阶段”更新为阶段 1 能力：

```md
> 当前具备阶段 1 本地单人可用看板：Hono API、SQLite 持久化、React 前端、卡片创建/列表/详情/基础编辑，以及 Vitest + Playwright 验收。
```

- [ ] **Step 2: 更新启动说明**

README 增加：

```md
## 前端开发

开发期使用两个本地服务：

- `pnpm dev`：启动 Hono API，默认 `http://127.0.0.1:3000`
- `pnpm dev:web`：启动 Vite React 前端，默认 `http://127.0.0.1:5173`

正式本地使用：

```bash
pnpm build:web
pnpm start
```

打开 `http://127.0.0.1:3000`。
```

- [ ] **Step 3: 更新验收说明**

README 增加阶段 1 人工验收：

```md
## 阶段 1 人工验收

1. 删除或更换本地 `DB_PATH`，从空库启动。
2. 打开前端首页，看到空状态。
3. 创建一张 task，标题和正文能保存。
4. 创建一张 decision，填写两个 options，详情抽屉能看到 options。
5. 创建一张 memo，类型显示正确。
6. 刷新页面，三张卡仍然存在。
7. 打开 task 详情，修改标题、正文、优先级、负责人，保存后仍显示更新内容。
8. 尝试创建空标题卡片，页面显示“标题不能为空”。
9. 使用类型筛选，列表只显示目标类型。
10. 连续记录至少 5 条真实事项，不需要 curl 或直接改数据库。
```

- [ ] **Step 4: 跑全部门禁**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm test:e2e
```

Expected: 全部通过。

- [ ] **Step 5: 提交前端和文档**

Run:

```powershell
git add package.json pnpm-lock.yaml src/app.ts src/http/static.ts web playwright.config.ts tests/e2e README.md
git commit -m "功能: 接入阶段一 React 看板

意图：让用户能通过浏览器完成建卡、看卡、打开详情和编辑基础字段。

主要修改：
- 增加 React + Vite 前端和 Hono 静态托管
- 实现紧凑工作台、左侧筛选、中间列表和右侧详情抽屉
- 提前接入 Playwright 覆盖阶段一网页验收"
```

Expected: commit-msg hook 和 pre-commit hook 通过。

## 4. 自动化测试覆盖清单

### HTTP 集成测试

- [ ] S1-T1 `POST /cards` 创建 `task` 成功返回 201，完整卡片字段，默认 `status=default`。
- [ ] S1-T2 创建 `decision` 保存 `options`，读取时为数组。
- [ ] S1-T3 创建 `memo` 成功；非 `decision` 的 `options` 被忽略。
- [ ] S1-T4 缺少 `type`、非法 `type`、缺少 `title`、纯空白 `title` 返回 400 并指出字段。
- [ ] S1-T5 `X-Actor` 写入 `created_by`，未传时为 `human`。
- [ ] S1-T6 `GET /cards` 支持 `type/status/lane/assignee` AND 过滤。
- [ ] S1-T7 默认分页 `limit=50`、`offset=0`，`total` 为过滤后总数。
- [ ] S1-T8 `all=true` 返回全部匹配卡片并忽略分页。
- [ ] S1-T9 非法 `limit/offset` 返回 400，含 `details.field` 和 `details.reason`。
- [ ] S1-T10 列表按 `created_at DESC, id DESC` 稳定排序。
- [ ] S1-T11 `GET /cards/{id}` 存在 200，不存在 404。
- [ ] S1-T12 `PATCH /cards/{id}` 更新允许字段并返回完整卡片。
- [ ] S1-T13 `PATCH /cards/{id}` 传 `status` 返回 400 且不落库。
- [ ] S1-T14 `PATCH /cards/{id}` 不存在返回 404。

### Playwright 端到端测试

- [ ] S1-T15 空库首页显示空状态。
- [ ] S1-T15 页面能创建 task 并在列表展示。
- [ ] S1-T15 页面能创建 decision，详情抽屉展示 options。
- [ ] S1-T15 页面能创建 memo，类型显示正确。
- [ ] S1-T15 页面能打开右侧详情抽屉。
- [ ] S1-T15 页面能编辑标题、正文、优先级、负责人。
- [ ] S1-T15 后端错误能在表单附近显示。
- [ ] S1-T15 类型筛选能更新列表。

## 5. 人工验收指南

1. `pnpm build:web`
2. `pnpm start`
3. 打开 `http://127.0.0.1:3000`
4. 空库时看到可理解空状态。
5. 创建一张 task，填写标题和正文，卡片出现在列表中。
6. 创建一张 decision，填写两个 options，打开详情抽屉能看到 options。
7. 创建一张 memo，类型显示正确。
8. 刷新页面，三张卡仍然存在。
9. 打开 task 详情，修改标题、正文、优先级、负责人，保存后仍显示更新内容。
10. 尝试创建空标题或纯空白标题，页面显示“标题不能为空”。
11. 使用类型筛选，列表只显示符合条件的卡片。
12. 连续记录至少 5 条真实事项，不使用 curl，不直接改数据库。

## 6. 提交拆分建议

1. `功能: 完成阶段一卡片 API`
   - 后端接口、校验、repository、统一错误体、HTTP 测试。
2. `功能: 接入阶段一 React 看板`
   - Vite/React、紧凑工作台、Hono 静态托管、Playwright。
3. `文档: 更新阶段一使用说明`
   - README 启动说明、API 示例、人工验收路径。

若第 2 个提交过大，可拆成：

- `构建: 接入 React 与 Vite 前端工具链`
- `功能: 实现阶段一看板前端`
- `测试: 接入阶段一 Playwright 验收`

拆分时必须遵守原子提交规则：`构建` 提交不混入功能代码，`测试` 提交不混入 README。

## 7. 阶段完成定义

阶段 1 完成必须同时满足：

- 后端 S1-T1 到 S1-T14 自动化测试全部覆盖且通过。
- 前端 S1-T15 用 Playwright 覆盖真实浏览器路径且通过。
- `pnpm test` 通过。
- `pnpm typecheck` 通过。
- `pnpm test:e2e` 通过。
- 人工验收 S1-H1 到 S1-H9 可按 README 操作完成。
- README 与实际启动和使用方式一致。
- `git status --short` 中不包含误提交的 `docs/`、`data/`、`代理执行笔记/`。

## 8. 自查记录

- 路线图 S1-F1 到 S1-F7 均有任务覆盖。
- 路线图 S1-D1 到 S1-D12 均进入接口设计或测试清单。
- 路线图 S1-X1 到 S1-X6 明确保持范围外。
- 路线图 S1-T1 到 S1-T15 均进入自动化测试覆盖清单。
- 路线图 S1-H1 到 S1-H9 均进入人工验收指南。
- 用户确认的视觉附件已归档到 `attachments/stage1-board-visual-demo.html`。
