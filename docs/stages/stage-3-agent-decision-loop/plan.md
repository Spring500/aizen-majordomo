# 阶段 3 Agent Decision Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付 agent 创建 decision、人类网页回复、agent 通过 CLI 等到回复的闭环，并建立独立 agent board 配置、skill 和 changes 事件流。

**Architecture:** 服务端继续使用 Hono + SQLite，新增 action 路由和 changes repository；`reply` action 复用阶段 2 的配置字段校验。Agent 侧交付物集中在 `agent-kit/`：配置作为独立场景资产，skill 内包含 CLI 和 references。前端在现有详情抽屉上增加正式回复区和等待回复筛选，不引入新大页面。

**Tech Stack:** Node.js >= 22.5、TypeScript ESM、Hono、SQLite `node:sqlite`、React、Vite、Vitest、Playwright、pnpm。

---

## 0. 执行前置

- 开发必须在 `codex/stage3-agent-loop` 或同等非 `main` 分支/worktree 上执行。
- 每个新增或修改的测试中，每个 `expect` 都必须带中文辅助信息。
- 不提交 `data/`、`.tmp/`、`代理执行笔记/`。
- 本计划以 `docs/stages/stage-3-agent-decision-loop/design.md` 为设计来源。

## 1. 文件结构计划

### 后端

- Modify: `src/db/schema.sql`
  - 扩展 `changes` 为事件流字段。
- Create: `src/changes/types.ts`
  - 定义 change event 类型和响应类型。
- Create: `src/changes/repository.ts`
  - 提供 `recordChange()`、`listChangesSince()`。
- Create: `src/changes/validation.ts`
  - 解析并校验 `since`。
- Create: `src/routes/changes.ts`
  - 提供 `GET /changes?since=`。
- Create: `src/cards/actions.ts`
  - 封装执行卡片 action 的业务逻辑。
- Modify: `src/routes/cards.ts`
  - 挂载 `POST /cards/:id/actions/:actionId`，并让 create/update 写入 changes。
- Modify: `src/cards/repository.ts`
  - 暴露必要的字段写入 helper，或增加可复用的 `updateCardFields()`。
- Modify: `src/app.ts`
  - 挂载 changes 路由。

### Agent Kit

- Create: `agent-kit/configs/agent-board-config/scenario.json`
- Create: `agent-kit/configs/agent-board-config/config.json`
- Create: `agent-kit/configs/agent-board-config/README.md`
- Create: `agent-kit/skills/majordomo/SKILL.md`
- Create: `agent-kit/skills/majordomo/scripts/majordomo.mjs`
- Create: `agent-kit/skills/majordomo/references/api.md`
- Create: `agent-kit/skills/majordomo/references/board-config.md`
- Create: `agent-kit/skills/majordomo/references/recovery.md`
- Create: `agent-kit/skills/majordomo/references/examples.md`
- Modify: `scripts/scenario-lib.ts`
  - 让场景工具能发现 `agent-kit/configs/*/scenario.json`。
- Modify: `scripts/scenario.ts`
  - 列表输出包含 agent kit 配置场景。

### 前端

- Modify: `web/src/api/cards.ts`
  - 增加 `runCardAction()`。
- Modify: `web/src/App.tsx`
  - 支持保存回复后刷新详情和列表。
- Modify: `web/src/components/CardDrawer.tsx`
  - 显示正式回复区。
- Modify: `web/src/components/SidebarFilters.tsx`
  - 增加等待回复筛选入口。
- Modify: `web/src/components/CardList.tsx`
  - 标记等待回复的 decision。
- Modify: `web/src/styles.css`
  - 补充回复区、等待标记和窄屏样式。

### 文档

- Modify: `README.md`
  - 在主干结构上补充阶段 3 和 agent-kit 入口。
- Modify: `docs/roadmap.md`
  - 仅在阶段 3 范围因 agent kit 正式交付发生变化时更新；不得把完成状态写入路线图。

### 测试

- Create: `tests/http/changes.test.ts`
- Create: `tests/http/card-actions.test.ts`
- Modify: `tests/http/cards.test.ts`
- Create: `tests/agent-kit/majordomo-cli.test.ts`
- Modify: `tests/scenario/scenario-lib.test.ts`
- Create: `tests/e2e/stage3-agent-decision-loop.spec.ts`

## 2. 数据模型

### 2.1 `changes` 表

阶段 3 将 `changes` 升级为事件流。推荐 schema：

```sql
CREATE TABLE IF NOT EXISTS changes (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  event        TEXT NOT NULL,
  card_id      TEXT NOT NULL,
  action       TEXT,
  field        TEXT,
  actor        TEXT,
  payload_json TEXT NOT NULL,
  at           INTEGER NOT NULL
);
```

已有库兼容策略：

- 当前阶段 2 的 `changes` 表尚未承载真实数据，可用迁移检测列结构。
- 如果缺少 `event` 或 `payload_json`，创建 `changes_next`，复制可映射字段，再重命名。
- 对旧字段 `old_value`、`new_value` 不再作为阶段 3 事实来源。

### 2.2 Change 事件

TypeScript 类型：

```ts
export interface ChangeEvent {
  seq: number;
  event: 'card.created' | 'card.updated' | 'card.action.reply' | string;
  cardId: string;
  action: string | null;
  field: string | null;
  actor: string | null;
  payload: Record<string, unknown>;
  at: number;
}
```

阶段 3 写入：

- `card.created`
- `card.updated`
- `card.action.reply`

## 3. HTTP 设计

### 3.1 `GET /changes?since=`

请求：

```text
GET /changes?since=0
```

响应：

```json
{
  "changes": [
    {
      "seq": 1,
      "event": "card.created",
      "cardId": "card-id",
      "action": null,
      "field": null,
      "actor": "agent",
      "payload": {
        "type": "decision",
        "status": "waiting",
        "fields": {
          "title": "是否采用方案 A？"
        }
      },
      "at": 1234567890
    }
  ],
  "latestSeq": 1
}
```

规则：

- `since` 必须存在或默认使用 `0`；实现时建议默认 `0`，便于 agent 首次读取。
- `since` 必须是大于或等于 0 的整数。
- 返回 `seq > since` 的变化。
- 按 `seq ASC` 排序。
- 没有变化时返回 `changes: []` 和当前 `latestSeq`。

### 3.2 `POST /cards/:id/actions/reply`

请求：

```json
{
  "fields": {
    "reply": "采用方案 A，因为风险更低。",
    "replied_by": "human"
  }
}
```

成功响应：

```json
{
  "card": {
    "id": "card-id",
    "type": "decision",
    "status": "waiting",
    "fields": {
      "reply": "采用方案 A，因为风险更低。",
      "replied_by": "human"
    }
  },
  "change": {
    "seq": 5,
    "event": "card.action.reply",
    "cardId": "card-id",
    "action": "reply"
  }
}
```

规则：

- 缺卡返回 404。
- 未声明 `reply` action 返回 400，错误体指出 `action`。
- 写入未允许字段返回 400。
- 缺少必填 `reply` 返回 400。
- 不修改状态。

## 4. CLI 设计

以下命令均从 `agent-kit/skills/majordomo/` skill 目录运行。

### 4.1 `ask`

参数式：

```powershell
node scripts/majordomo.mjs ask --title "是否采用方案 A？" --body "请确认。" --option "采用 A" --option "采用 B"
```

stdin JSON：

```powershell
node scripts/majordomo.mjs ask --stdin < decision.json
```

stdin JSON 结构：

```json
{
  "title": "是否采用方案 A？",
  "body": "背景说明",
  "options": ["采用 A", "采用 B"],
  "fields": {
    "priority": 1,
    "risk_level": "normal"
  }
}
```

默认输出：

```text
已创建等待人类回复的 decision。

本次询问的 card id 是：<card-id>

运行以下命令等待回复：
node scripts/majordomo.mjs wait-reply --card-id <card-id>
```

### 4.2 `wait-reply`

命令：

```powershell
node scripts/majordomo.mjs wait-reply --card-id <card-id>
```

行为：

- 首先读取当前卡片。
- 如果 `reply` 已存在，立即输出。
- 否则轮询 changes。
- 每次发现相关变化后重新读取卡片。
- 不超时。

默认输出：

```text
已收到人类回复。

card id：<card-id>
回复人：human
回复内容：
<reply>
```

## 5. 任务拆分

### Task 1: 建立 changes 事件流

**Files:**
- Modify: `src/db/schema.sql`
- Create: `src/changes/types.ts`
- Create: `src/changes/repository.ts`
- Create: `src/changes/validation.ts`
- Create: `src/routes/changes.ts`
- Modify: `src/app.ts`
- Create: `tests/http/changes.test.ts`

- [ ] **Step 1: 写失败测试：空 changes 可读取**

在 `tests/http/changes.test.ts` 添加测试：

```ts
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.ts';

describe('GET /changes', () => {
  it('空库从 0 开始读取时返回空变化列表', async () => {
    const { app } = createTestApp();
    const res = await app.request('/changes?since=0');
    const body = await res.json();

    expect(res.status, '空库读取 changes 应该成功，失败时检查 /changes 路由是否挂载').toBe(200);
    expect(body.changes, '空库没有事件，changes 应该是空数组').toEqual([]);
    expect(body.latestSeq, '空库 latestSeq 应该为 0，便于 agent 保存游标').toBe(0);
  });
});
```

Run:

```powershell
pnpm test -- tests/http/changes.test.ts
```

Expected: FAIL，原因是 `/changes` 未实现。

- [ ] **Step 2: 修改 schema**

将 `changes` 表定义改为事件模型：

```sql
CREATE TABLE IF NOT EXISTS changes (
  seq          INTEGER PRIMARY KEY AUTOINCREMENT,
  event        TEXT NOT NULL,
  card_id      TEXT NOT NULL,
  action       TEXT,
  field        TEXT,
  actor        TEXT,
  payload_json TEXT NOT NULL,
  at           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_changes_seq ON changes(seq);
CREATE INDEX IF NOT EXISTS idx_changes_card ON changes(card_id);
```

- [ ] **Step 3: 添加 changes 类型**

在 `src/changes/types.ts` 写入：

```ts
export interface ChangeEvent {
  seq: number;
  event: string;
  cardId: string;
  action: string | null;
  field: string | null;
  actor: string | null;
  payload: Record<string, unknown>;
  at: number;
}

export interface ChangeRow {
  seq: number;
  event: string;
  card_id: string;
  action: string | null;
  field: string | null;
  actor: string | null;
  payload_json: string;
  at: number;
}
```

- [ ] **Step 4: 添加 repository**

在 `src/changes/repository.ts` 实现：

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { ChangeEvent, ChangeRow } from './types.ts';

function parsePayload(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {};
}

export function serializeChange(row: ChangeRow): ChangeEvent {
  return {
    seq: row.seq,
    event: row.event,
    cardId: row.card_id,
    action: row.action,
    field: row.field,
    actor: row.actor,
    payload: parsePayload(row.payload_json),
    at: row.at,
  };
}

export function recordChange(
  db: DatabaseSync,
  input: {
    event: string;
    cardId: string;
    action?: string | null;
    field?: string | null;
    actor?: string | null;
    payload?: Record<string, unknown>;
    at?: number;
  },
): ChangeEvent {
  const row = {
    event: input.event,
    card_id: input.cardId,
    action: input.action ?? null,
    field: input.field ?? null,
    actor: input.actor ?? null,
    payload_json: JSON.stringify(input.payload ?? {}),
    at: input.at ?? Date.now(),
  };
  const result = db
    .prepare(
      `INSERT INTO changes (event, card_id, action, field, actor, payload_json, at)
       VALUES (@event, @card_id, @action, @field, @actor, @payload_json, @at)`,
    )
    .run(row);
  return serializeChange({ seq: Number(result.lastInsertRowid), ...row });
}

export function listChangesSince(db: DatabaseSync, since: number): { changes: ChangeEvent[]; latestSeq: number } {
  const rows = db
    .prepare('SELECT * FROM changes WHERE seq > @since ORDER BY seq ASC')
    .all({ since }) as unknown as ChangeRow[];
  const latest = db.prepare('SELECT COALESCE(MAX(seq), 0) AS seq FROM changes').get() as { seq: number };
  return { changes: rows.map(serializeChange), latestSeq: latest.seq };
}
```

- [ ] **Step 5: 添加 since 校验**

在 `src/changes/validation.ts` 实现：

```ts
export function parseSince(url: URL) {
  const raw = url.searchParams.get('since') ?? '0';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false as const, error: { field: 'since', reason: 'since 必须是大于或等于 0 的整数' } };
  }
  return { ok: true as const, value };
}
```

- [ ] **Step 6: 添加路由并挂载**

`src/routes/changes.ts`：

```ts
import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';
import { listChangesSince } from '../changes/repository.ts';
import { parseSince } from '../changes/validation.ts';
import { badRequest } from '../http/errors.ts';

export const changes = new Hono<AppEnv>();

changes.get('/', (c) => {
  const parsed = parseSince(new URL(c.req.url));
  if (!parsed.ok) return badRequest(c, 'VALIDATION_ERROR', '查询参数无效', parsed.error);
  return c.json(listChangesSince(c.get('db'), parsed.value));
});
```

`src/app.ts` 挂载：

```ts
import { changes } from './routes/changes.ts';

app.route('/changes', changes);
```

- [ ] **Step 7: 跑测试**

Run:

```powershell
pnpm test -- tests/http/changes.test.ts
```

Expected: PASS。

- [ ] **Step 8: 补非法 since 测试**

在同文件增加：

```ts
it('非法 since 返回 400 并指出字段', async () => {
  const { app } = createTestApp();
  const res = await app.request('/changes?since=-1');
  const body = await res.json();

  expect(res.status, '非法 since 应返回 400，失败时检查 parseSince 校验').toBe(400);
  expect(body.error.details.field, '错误详情应指出 since，便于 agent 修正请求').toBe('since');
});
```

Run:

```powershell
pnpm test -- tests/http/changes.test.ts
```

Expected: PASS。

### Task 2: 创建、编辑写入 changes

**Files:**
- Modify: `src/routes/cards.ts`
- Modify: `tests/http/cards.test.ts`
- Modify: `tests/http/changes.test.ts`

- [ ] **Step 1: 写创建写入 changes 测试**

在 `tests/http/changes.test.ts` 添加：

```ts
it('创建卡片写入 card.created 事件', async () => {
  const { app } = createTestApp();
  const create = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
    body: JSON.stringify({ type: 'task', fields: { title: '记录创建事件' } }),
  });
  const created = await create.json();

  const res = await app.request('/changes?since=0');
  const body = await res.json();

  expect(res.status, '读取创建后的 changes 应成功，失败时检查 changes 路由').toBe(200);
  expect(body.changes[0].event, '创建卡片应写入 card.created 事件').toBe('card.created');
  expect(body.changes[0].cardId, '创建事件应包含新卡片 id').toBe(created.card.id);
  expect(body.changes[0].actor, '创建事件应记录 X-Actor').toBe('agent');
});
```

Run:

```powershell
pnpm test -- tests/http/changes.test.ts
```

Expected: FAIL，原因是创建尚未记录事件。

- [ ] **Step 2: 在 create 成功后记录事件**

在 `src/routes/cards.ts` 的 `cards.post('/')` 成功创建后加入：

```ts
const change = recordChange(c.get('db'), {
  event: 'card.created',
  cardId: row.id,
  actor: c.req.header('X-Actor') ?? 'human',
  payload: {
    type: row.type,
    status: row.status,
    fields: row.fields,
  },
});
return c.json({ card: row, change }, 201);
```

并导入：

```ts
import { recordChange } from '../changes/repository.ts';
```

- [ ] **Step 3: 写编辑写入 changes 测试**

添加：

```ts
it('编辑卡片写入 card.updated 事件', async () => {
  const { app } = createTestApp();
  const create = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'task', fields: { title: '原标题' } }),
  });
  const created = await create.json();
  const firstChanges = await (await app.request('/changes?since=0')).json();
  const lastSeq = firstChanges.latestSeq;

  await app.request(`/cards/${created.card.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
    body: JSON.stringify({ fields: { title: '新标题' } }),
  });
  const res = await app.request(`/changes?since=${lastSeq}`);
  const body = await res.json();

  expect(body.changes.length, '从上次游标读取应只返回编辑后的新事件').toBe(1);
  expect(body.changes[0].event, '编辑卡片应写入 card.updated 事件').toBe('card.updated');
  expect(body.changes[0].payload.fields.title, '编辑事件 payload 应包含本次写入字段').toBe('新标题');
});
```

- [ ] **Step 4: 在 patch 成功后记录事件**

在 `cards.patch('/:id')` 成功后加入：

```ts
const change = recordChange(c.get('db'), {
  event: 'card.updated',
  cardId: row.id,
  actor: c.req.header('X-Actor') ?? 'human',
  payload: { fields: actionResult.fields },
});
return c.json({ card: row, change });
```

- [ ] **Step 5: 跑相关测试**

Run:

```powershell
pnpm test -- tests/http/changes.test.ts tests/http/cards.test.ts
```

Expected: PASS。

### Task 3: 实现 reply action 接口

**Files:**
- Create: `src/cards/actions.ts`
- Modify: `src/routes/cards.ts`
- Create: `tests/http/card-actions.test.ts`

- [ ] **Step 1: 写成功回复测试**

`tests/http/card-actions.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.ts';

async function createDecision(app: ReturnType<typeof createTestApp>['app']) {
  const res = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
    body: JSON.stringify({
      type: 'decision',
      status: 'waiting',
      fields: { title: '需要回复', options: ['A', 'B'] },
    }),
  });
  return (await res.json()).card;
}

describe('POST /cards/:id/actions/reply', () => {
  it('人类可以对声明 reply action 的 decision 提交正式回复', async () => {
    const { app } = createTestApp();
    const card = await createDecision(app);

    const res = await app.request(`/cards/${card.id}/actions/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ fields: { reply: '选择 A', replied_by: 'human' } }),
    });
    const body = await res.json();

    expect(res.status, '提交 decision 回复应成功，失败时检查 reply action 路由和配置校验').toBe(200);
    expect(body.card.fields.reply, '正式回复应持久化到 fields.reply').toBe('选择 A');
    expect(body.card.fields.replied_by, '回复人应持久化到 fields.replied_by').toBe('human');
    expect(body.card.status, '阶段 3 回复不应自动修改状态').toBe('waiting');
    expect(body.change.event, '回复应写入 card.action.reply 事件').toBe('card.action.reply');
  });
});
```

Run:

```powershell
pnpm test -- tests/http/card-actions.test.ts
```

Expected: FAIL，原因是 action 路由未实现。

- [ ] **Step 2: 实现 action 执行函数**

`src/cards/actions.ts`：

```ts
import type { DatabaseSync } from 'node:sqlite';
import type { AppConfig } from '../config/types.ts';
import { recordChange } from '../changes/repository.ts';
import { findCardById, findCardType, updateCard, validateActionFields } from './repository.ts';

export function runCardAction(
  db: DatabaseSync,
  config: AppConfig,
  input: { cardId: string; actionId: string; fields: Record<string, unknown>; actor: string },
) {
  const existing = findCardById(db, input.cardId);
  if (!existing) return { ok: false as const, status: 404 as const };

  const cardType = findCardType(config, existing.type);
  if (!cardType) {
    return {
      ok: false as const,
      status: 400 as const,
      error: { field: 'type', reason: `卡片类型配置不存在：${existing.type}` },
    };
  }

  const actionResult = validateActionFields(cardType, input.actionId, input.fields);
  if (!actionResult.ok) {
    return { ok: false as const, status: 400 as const, error: actionResult.error };
  }

  const card = updateCard(db, existing.id, { fields: actionResult.fields });
  if (!card) return { ok: false as const, status: 404 as const };

  const change = recordChange(db, {
    event: `card.action.${input.actionId}`,
    cardId: card.id,
    action: input.actionId,
    actor: input.actor,
    payload: { fields: actionResult.fields },
  });
  return { ok: true as const, card, change };
}
```

- [ ] **Step 3: 挂载 action 路由**

在 `src/routes/cards.ts` 增加：

```ts
cards.post('/:id/actions/:actionId', async (c) => {
  const parsed = normalizeUpdateBody(await c.req.json().catch(() => undefined));
  if (!parsed.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', parsed.error);
  if (parsed.value.statusPresent) {
    return badRequest(c, 'STATUS_PATCH_FORBIDDEN', '不允许通过 action 修改 status', {
      field: 'status',
      reason: '请使用 transition 接口修改状态',
    });
  }

  const config = readConfig(c.get('db'));
  const result = runCardAction(c.get('db'), config, {
    cardId: c.req.param('id'),
    actionId: c.req.param('actionId'),
    fields: parsed.value.fields,
    actor: c.req.header('X-Actor') ?? 'human',
  });

  if (!result.ok && result.status === 404) return notFound(c);
  if (!result.ok) return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', result.error);
  return c.json({ card: result.card, change: result.change });
});
```

并导入：

```ts
import { runCardAction } from '../cards/actions.ts';
```

- [ ] **Step 4: 补未声明 action 测试**

添加：

```ts
it('未声明 reply action 的类型不能提交正式回复', async () => {
  const { app } = createTestApp();
  const create = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'task', fields: { title: '普通任务' } }),
  });
  const task = (await create.json()).card;

  const res = await app.request(`/cards/${task.id}/actions/reply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { reply: '不应允许' } }),
  });
  const body = await res.json();

  expect(res.status, 'task 未声明 reply action，应返回 400').toBe(400);
  expect(body.error.details.field, '错误详情应指向 action，便于 agent 知道动作不可用').toBe('action');
});
```

- [ ] **Step 5: 补字段校验测试**

添加：

```ts
it('reply action 只能写入配置允许字段', async () => {
  const { app } = createTestApp();
  const card = await createDecision(app);

  const res = await app.request(`/cards/${card.id}/actions/reply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { reply: '选择 A', title: '不允许改标题' } }),
  });
  const body = await res.json();

  expect(res.status, 'reply action 写入未允许字段应返回 400').toBe(400);
  expect(body.error.details.field, '错误详情应指出未允许字段 title').toBe('title');
});
```

- [ ] **Step 6: 跑 action 测试**

Run:

```powershell
pnpm test -- tests/http/card-actions.test.ts tests/http/changes.test.ts
```

Expected: PASS。

### Task 4: 落地 agent-board-config 场景

**Files:**
- Create: `agent-kit/configs/agent-board-config/scenario.json`
- Create: `agent-kit/configs/agent-board-config/config.json`
- Create: `agent-kit/configs/agent-board-config/README.md`
- Modify: `scripts/scenario-lib.ts`
- Modify: `tests/scenario/scenario-lib.test.ts`

- [ ] **Step 1: 新增配置资产**

`scenario.json`：

```json
{
  "id": "agent-board-config",
  "name": "Agent 实战看板配置",
  "description": "用于 agent 创建 decision、等待人类回复和读取 changes 的实战协作配置。",
  "config": "config.json",
  "readme": "README.md",
  "tags": ["stage3", "agent-kit", "decision-loop"],
  "expected": {
    "cardTypes": ["task", "decision", "memo"],
    "statuses": ["default", "active", "waiting", "resolved", "done"]
  }
}
```

`config.json` 从 `scenarios/default-sample/config.json` 的核心 id 起步，保留：

- `task`、`decision`、`memo`
- `default`、`active`、`waiting`、`resolved`、`done`
- `decision` 的 `options`、`reply`、`replied_by`
- `decision` 的 `reply` action
- `transition`、`webhook`、`script` hook action model 骨架

`README.md` 说明配置语义，不写实现计划。

- [ ] **Step 2: 修改场景发现目录**

在 `scripts/scenario-lib.ts` 增加候选根：

```ts
export const SCENARIO_ROOTS = [
  resolve(process.cwd(), 'scenarios'),
  resolve(process.cwd(), 'agent-kit', 'configs'),
];
```

把 `scenarioDir(id)` 改为查找包含 `scenario.json` 的目录：

```ts
function scenarioDir(id: string): string {
  for (const root of SCENARIO_ROOTS) {
    const dir = join(root, id);
    if (existsSync(join(dir, 'scenario.json'))) return dir;
  }
  return join(SCENARIOS_DIR, id);
}
```

把 `listScenarios()` 改为遍历两个根目录并读取 manifest。

- [ ] **Step 3: 补场景列表测试**

在 `tests/scenario/scenario-lib.test.ts` 添加：

```ts
it('场景列表包含 agent kit 的实战看板配置', () => {
  const scenarios = listScenarios();
  const ids = scenarios.map((item) => item.id);

  expect(ids, 'agent-board-config 应作为 agent-kit 配置场景出现在列表中').toContain('agent-board-config');
});
```

- [ ] **Step 4: 跑场景测试**

Run:

```powershell
pnpm test -- tests/scenario/scenario-lib.test.ts
pnpm scenario:prepare agent-board-config
```

Expected: PASS，prepare 输出 prepared db 路径。

### Task 5: 实现 agent CLI

**Files:**
- Create: `agent-kit/skills/majordomo/scripts/majordomo.mjs`
- Create: `tests/agent-kit/majordomo-cli.test.ts`

- [ ] **Step 1: 写 CLI 参数解析和 HTTP helper**

`majordomo.mjs` 使用 Node 内置能力，不新增依赖：

```js
#!/usr/bin/env node

import { readFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      args._.push(item);
      continue;
    }
    const key = item.slice(2);
    if (key === 'stdin') {
      args.stdin = true;
      continue;
    }
    const value = argv[i + 1];
    i += 1;
    if (key === 'option') {
      args.option = [...(args.option ?? []), value];
    } else {
      args[key] = value;
    }
  }
  return args;
}

function baseUrl(args) {
  return String(args['base-url'] ?? process.env.MAJORDOMO_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
}

async function requestJson(url, init) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.details?.reason ?? body?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(reason);
  }
  return body;
}
```

- [ ] **Step 2: 实现 ask 输入**

```js
function readStdinJson() {
  const raw = readFileSync(0, 'utf8');
  return JSON.parse(raw);
}

function buildAskInput(args) {
  if (args.stdin) return readStdinJson();
  if (!args.title) throw new Error('ask 需要 --title，复杂输入可使用 --stdin');
  return {
    title: args.title,
    body: args.body,
    options: args.option ?? [],
    fields: {},
  };
}
```

- [ ] **Step 3: 实现 ask 命令**

```js
async function ask(args) {
  const input = buildAskInput(args);
  const fields = {
    ...(input.fields ?? {}),
    title: input.title,
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.options !== undefined ? { options: input.options } : {}),
  };
  const body = await requestJson(`${baseUrl(args)}/cards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
    body: JSON.stringify({ type: 'decision', status: 'waiting', fields }),
  });
  const id = body.card.id;
  console.log(`已创建等待人类回复的 decision。

本次询问的 card id 是：${id}

运行以下命令等待回复：
node scripts/majordomo.mjs wait-reply --card-id ${id}`);
}
```

- [ ] **Step 4: 实现 wait-reply 命令**

```js
function extractReply(card) {
  const reply = card?.fields?.reply ?? card?.reply;
  if (typeof reply === 'string' && reply.trim().length > 0) {
    return { reply, repliedBy: card?.fields?.replied_by ?? card?.replied_by ?? 'human' };
  }
  return null;
}

async function getCard(args, cardId) {
  const body = await requestJson(`${baseUrl(args)}/cards/${cardId}`);
  return body.card;
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitReply(args) {
  const cardId = args['card-id'];
  if (!cardId) throw new Error('wait-reply 需要 --card-id');
  let latestSeq = 0;
  while (true) {
    const card = await getCard(args, cardId);
    const found = extractReply(card);
    if (found) {
      console.log(`已收到人类回复。

card id：${cardId}
回复人：${found.repliedBy}
回复内容：
${found.reply}`);
      return;
    }
    const changes = await requestJson(`${baseUrl(args)}/changes?since=${latestSeq}`);
    latestSeq = changes.latestSeq ?? latestSeq;
    await wait(2000);
  }
}
```

- [ ] **Step 5: 实现 main**

```js
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (command === 'ask') return ask(args);
  if (command === 'wait-reply') return waitReply(args);
  throw new Error('可用命令：ask, wait-reply');
}

main().catch((error) => {
  console.error(`majordomo CLI 失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
```

- [ ] **Step 6: 写 CLI 单元测试**

`tests/agent-kit/majordomo-cli.test.ts` 用子进程启动测试服务或复用已有 HTTP helper。至少覆盖：

```ts
it('ask 输出 card id 和 wait-reply 命令', async () => {
  // 使用临时端口启动 app server，运行 skill 内 CLI ask
  // 断言 stdout 包含“本次询问的 card id 是”和 skill 内 CLI wait-reply 命令
});
```

每个 `expect` 带中文辅助信息。

- [ ] **Step 7: 跑 CLI 测试**

Run:

```powershell
pnpm test -- tests/agent-kit/majordomo-cli.test.ts
```

Expected: PASS。

### Task 6: 编写 skill 和 agent references

**Files:**
- Create: `agent-kit/skills/majordomo/SKILL.md`
- Create: `agent-kit/skills/majordomo/references/api.md`
- Create: `agent-kit/skills/majordomo/references/board-config.md`
- Create: `agent-kit/skills/majordomo/references/recovery.md`
- Create: `agent-kit/skills/majordomo/references/examples.md`

- [ ] **Step 1: 写 SKILL.md**

内容必须短，包含：

```markdown
---
name: majordomo
description: Use when an AI agent needs to ask a human for an asynchronous decision through a local aizen-majordomo board, wait for the human reply, recover from interrupted waits, or inspect the agent board workflow.
---

# Majordomo Agent Workflow

Use the bundled CLI before writing custom HTTP calls.

## Ask For A Decision

From the skill directory, run `node scripts/majordomo.mjs ask`.

For short input, use `--title`, `--body`, and repeated `--option`.
For long or structured input, write a JSON file and run `node scripts/majordomo.mjs ask --stdin < file.json`.

After `ask`, read the returned card id and run the exact `wait-reply` command printed by the CLI.

## Wait For A Reply

From the skill directory, run `node scripts/majordomo.mjs wait-reply --card-id <id>`.

Human replies may take a long time. Allow this command to block. Do not infer failure from a long wait.

If the command is interrupted, run the same `wait-reply` command again. It checks the current card before waiting for new changes.

## References

- Read `references/examples.md` for complete workflows.
- Read `references/recovery.md` when a wait was interrupted or the service restarted.
- Read `references/board-config.md` when deciding which card type or status to use.
- Read `references/api.md` only when the CLI is insufficient.
```

- [ ] **Step 2: 写 API reference**

Include `POST /cards`, `POST /cards/:id/actions/reply`, `GET /changes?since=`, `GET /cards/:id`.

- [ ] **Step 3: 写 board-config reference**

Document `task`、`decision`、`memo`、`waiting`、`reply` action and fields.

- [ ] **Step 4: 写 recovery reference**

Document:

- Re-run `wait-reply` with the same card id after interruption.
- Do not rely on remembering `since`.
- If card id is lost, inspect recent `decision` cards through the board or `/changes`.

- [ ] **Step 5: 写 examples reference**

Include:

- short `ask`.
- stdin JSON `ask`.
- `wait-reply`.
- interrupted wait recovery.

### Task 7: 前端提交回复和等待回复视图

**Files:**
- Modify: `web/src/api/cards.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/CardDrawer.tsx`
- Modify: `web/src/components/SidebarFilters.tsx`
- Modify: `web/src/components/CardList.tsx`
- Modify: `web/src/styles.css`
- Create: `tests/e2e/stage3-agent-decision-loop.spec.ts`

- [ ] **Step 1: 添加 API client**

`web/src/api/cards.ts`：

```ts
export async function runCardAction(
  id: string,
  actionId: string,
  input: { fields: Record<string, unknown> },
): Promise<Card> {
  const res = await fetch(`/cards/${id}/actions/${actionId}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return (await parseResponse<CardResponse>(res)).card;
}
```

- [ ] **Step 2: App 传入 reply handler**

在 `App.tsx` 添加：

```ts
async function reply(input: { fields: Record<string, unknown> }) {
  if (!selected) return;
  const card = await runCardAction(selected.id, 'reply', input);
  setSelected(card);
  await loadCards();
}
```

传给 `CardDrawer`。

- [ ] **Step 3: CardDrawer 显示回复区**

在 `CardDrawer.tsx` 增加：

- 若当前 card type 有 `reply` action，显示正式回复区。
- 若 `card.fields.reply` 已存在，展示回复内容和回复人。
- 否则显示 textarea 和提交按钮。
- 提交时调用 `onReply({ fields: { reply, replied_by: 'human' } })`。

- [ ] **Step 4: SidebarFilters 增加等待回复入口**

添加一个按钮或筛选项，点击后设置：

```ts
{ ...filters, type: 'decision', status: 'waiting', offset: 0 }
```

文案使用“等待回复”。

- [ ] **Step 5: CardList 标记等待回复**

对 `card.type === 'decision' && card.status === 'waiting' && !card.fields.reply` 显示“等待回复”标记。

- [ ] **Step 6: E2E 覆盖宽屏和窄屏**

测试路径：

1. API 创建 `status=waiting` 的 decision。
2. 前端点击“等待回复”筛选。
3. 打开卡片详情。
4. 提交回复。
5. 详情显示回复内容和回复人。
6. 窄屏重复核心路径。

Run:

```powershell
pnpm test:e2e -- tests/e2e/stage3-agent-decision-loop.spec.ts
```

Expected: PASS。

### Task 8: README 入口补充

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 保持 README 主干结构**

README 保留：

- 项目一句话说明。
- 当前能力摘要。
- 环境要求。
- 安装。
- 启动。
- agent-kit 使用入口。
- 常用命令。
- `CONTRIBUTING.md` 开发规则链接。
- 路线图链接。

- [ ] **Step 2: 加 agent-kit 入口**

README 中加入：

```markdown
## Agent Kit

已包含面向 agent 协作的配置、skill 和 CLI 交付物。
```

### Task 9: 全量验证

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

- [ ] **Step 5: Agent config 场景**

Run:

```powershell
pnpm scenario:prepare agent-board-config
```

Expected: prepared db generated without config validation errors.

## 6. 自动化测试覆盖清单

- [ ] S3-T1 创建卡片写入递增 changes，包含 `seq`、`cardId`、`event`、`actor`、`at`。
- [ ] S3-T2 编辑卡片写入 changes。
- [ ] S3-T3 `GET /changes?since=0` 按 `seq` 升序返回变化。
- [ ] S3-T4 `GET /changes?since=<lastSeq>` 只返回之后的新变化。
- [ ] S3-T5 非法 `since` 返回 400，错误体指出 `since`。
- [ ] S3-T6 人类回复 decision 后，`reply` 和 `replied_by` 持久化。
- [ ] S3-T7 回复写入 changes，agent 可从 changes 看到回复。
- [ ] S3-T8 changes 使用 `seq` 作为游标，不依赖 `updated_at`。
- [ ] S3-T9 前端等待回复视图能筛出待处理 decision，提交回复后标记更新。
- [ ] S3-T10 只有声明 `reply` action 和回复字段能力的类型可以提交正式回复。
- [ ] S3-T11 回复入口按 `reply` action 声明的可写字段校验请求。
- [ ] CLI `ask` 创建 `status=waiting` 的 decision，并输出 card id 与等待命令。
- [ ] CLI `wait-reply` 对已回复卡片可立即返回，对未回复卡片会等待。
- [ ] `agent-board-config` 可被场景工具加载。

## 7. 人工验收指南

1. 启动 agent board 配置场景：

```powershell
pnpm scenario:start agent-board-config --fresh
```

2. 用 CLI 创建 decision：

```powershell
node scripts/majordomo.mjs ask --title "是否采用方案 A？" --body "请确认。" --option "采用 A" --option "采用 B"
```

3. 记录 CLI 输出的 card id。
4. 在网页点击“等待回复”，打开该 decision。
5. 提交正式回复。
6. 刷新页面，确认回复仍存在。
7. 运行 CLI 输出的 `wait-reply` 命令，确认能读到回复。
8. 请求 `/changes?since=0`，确认包含创建和回复事件。
9. 用最大 `seq` 再请求 `/changes?since=<seq>`，确认无新变化时返回空列表。
10. 在窄屏宽度重复“等待回复 -> 打开详情 -> 提交回复”路径。

## 8. 提交拆分建议

1. `文档: 固化阶段三人机闭环方案`
   - 仅包含阶段 3 设计和计划文档。
2. `功能: 建立阶段三 changes 事件流`
   - changes schema、repository、`GET /changes`、创建/编辑事件。
3. `功能: 增加卡片 action 回复接口`
   - action route、reply 校验和回复事件。
4. `功能: 交付 agent 看板配置和 CLI`
   - `agent-kit/configs`、skill CLI、CLI 测试。
5. `文档: 补充 majordomo agent skill`
   - skill 和 references；如果同时改 CLI 则不要用纯文档提交。
6. `功能: 前端支持等待回复闭环`
   - 回复区、等待回复筛选、列表标记、E2E。
7. `文档: 补充 README 阶段三入口`
   - 在主干 README 结构上补充 agent-kit、CLI 和阶段 3 文档链接。

## 9. 阶段完成定义

- 后端支持 `GET /changes?since=`。
- 创建、编辑、回复均写入事件型 changes。
- 后端支持 `POST /cards/:id/actions/reply`。
- reply action 基于配置校验，不写死卡片类型。
- 回复不会自动修改状态。
- `agent-kit/configs/agent-board-config` 可被场景工具加载。
- `agent-kit/skills/majordomo` 包含 skill、CLI 和 references。
- `node scripts/majordomo.mjs ask` 创建 `status=waiting` 的 decision。
- `node scripts/majordomo.mjs ask` 输出 card id 和对应 wait 命令。
- `node scripts/majordomo.mjs wait-reply --card-id <id>` 能等待或立即返回已有回复。
- CLI 不提供超时，不提供 ask/wait-reply 之外的命令。
- 前端能筛出等待回复 decision 并提交正式回复。
- README 在主干结构上补充阶段 3 入口，不新增重复的开发者说明文档。
- S3-T1 到 S3-T11 均有自动化覆盖。
- 宽屏和窄屏 E2E 覆盖回复闭环。
- `pnpm test`、`pnpm typecheck`、`pnpm build:web`、`pnpm test:e2e` 通过。

## 10. 自查记录

- 计划覆盖路线图阶段 3 的 S3-F1 到 S3-F8。
- 计划覆盖路线图阶段 3 的 S3-T1 到 S3-T11。
- 计划保留阶段 3 范围外事项：认证、状态流转、hook 执行、SSE/WebSocket、评论。
- 计划纳入用户已确认的 agent-kit 目录、独立 agent-board-config、CLI 输出和无超时要求。
- 计划没有把已确认决策再次包装成需要用户反复确认的问题。
