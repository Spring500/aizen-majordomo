# 阶段 2 基础配置模型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付基础配置模型：运行时配置以 SQLite 为事实来源，样例配置可初始化和校验，现有建卡、编辑、列表过滤和前端表单开始由配置驱动。

**Architecture:** 后端继续使用 Hono + `node:sqlite`。配置由 `scenarios/default-sample/config.json` 作为默认种子，或由 `CONFIG_SEED_PATH` 指定 JSON 种子，初始化时同步到 SQLite；运行时读取数据库配置。卡片业务字段统一进入 `card_field_values`，`cards` 只保留核心元数据和状态。前端启动时读取 `GET /config`，按 card type、field definition 和内置 `create/update` action 渲染新建与编辑表单。

**Tech Stack:** Node.js >= 22.5、TypeScript ESM、Hono、SQLite `node:sqlite`、zod、React、Vite、Vitest、Playwright、pnpm。

---

## 补充规格

阶段 2 的配置化基建必须包含场景化配置测试能力。补充规格和执行拆解见：

- `docs/stages/stage-2-basic-config-model/scenario-config-testing-spec.md`
- `docs/stages/stage-2-basic-config-model/scenario-config-testing-plan.md`

该补充规格属于阶段 2 完成范围，不是后续阶段事项。

## 0. 已确认决策

- 开发必须在分支或 worktree 上进行，不在 `main` 直接实现。
- 运行时配置以 SQLite 为事实来源；默认配置种子来自 `scenarios/default-sample/config.json`，测试场景也使用 `scenarios/` 下的 JSON 配置。
- 配置存储采用“核心实体表 + JSON 能力字段”：`card_types`、`statuses`、`transitions`、`hook_action_models`、`hooks` 是核心实体；字段能力、动作能力、match、action 参数用 JSON 表达。
- 阶段 2 配置种子初始化采用同 id 覆盖更新，保证数据库配置与种子定义一致。
- 配置初始化和引用校验 fail fast；配置无效时初始化或启动失败。
- 字段能力使用字段定义数组。字段定义描述字段本身；动作定义声明允许写入哪些字段。
- 内置 `create` 动作用于 `POST /cards`；内置 `update` 动作用于 `PATCH /cards/{id}`。
- `cards` 表只保留核心元数据和状态；`title/body/options/lane/priority/assignee/reply/replied_by` 等业务字段统一存入 `card_field_values`。
- 字段值统一存为 JSON：`card_field_values.value_json`。`null` 不存行，缺失字段读取为 `null`；`false`、`0`、`""`、`[]` 正常存行。
- 响应采用双形状过渡：新增 `fields`，同时保留阶段 1 的扁平字段。
- 请求采用双形状过渡：接受 `{ fields: {...} }`，也兼容阶段 1 扁平字段；同字段同时出现在两处时返回 400。
- `GET /cards` 支持 `field.<fieldId>=<value>` 类型感知基础过滤；旧的 `lane`、`assignee` 查询参数保留为兼容别名。
- 前端必须消费 `GET /config`，新建和编辑表单从配置动态渲染。
- 默认配置和测试配置统一使用 `scenarios/` 下的 JSON 场景配置；不再维护独立 TypeScript 样例配置作为配置事实来源。
- 人工验收采用场景 README 说明“场景内容、用途和可观察点”；交付说明不写入场景 README。
- 配置化筛选采用“字段条件列表”：用户可逐条添加字段条件，字段候选来自当前配置，并在选择时展示字段类型；已定义但阶段 2 不支持过滤语义的字段也出现在候选中并标注“暂未支持”。
- 字段条件列表采用紧凑行布局；未支持过滤的字段使用“未支持筛选”文案，不使用容易换行的 `! ... 暂未支持` 组合或大块警告说明。
- 卡片列表展示不强制要求 `title`、`priority` 或 `assignee` 字段；当 `title` 为空或业务类型未定义标题字段时，列表使用配置字段生成最小可读主信息和副信息。
- 大量数据列表采用显式分页，不做无限滚动；前端传递 `limit/offset`，默认每页 50，允许切换 50/100/200/500，筛选变化回到第一页。
- 配置化筛选的宽屏和窄屏讨论稿归档到 `attachments/`，阶段 2 实现以正式代码和本计划为准。

## 1. 文件结构计划

### 后端配置模型

- Create: `src/config/types.ts`
  - 定义 `FieldDefinition`、`ActionDefinition`、`CardTypeConfig`、`StatusConfig`、`TransitionConfig`、`HookActionModelConfig`、`HookConfig`、`AppConfig`。
- Create: `src/config/load-seed.ts`
  - 从默认场景 JSON 或 `CONFIG_SEED_PATH` 读取配置种子。
- Create: `src/config/validation.ts`
  - 使用 zod 和引用校验验证配置结构与内部引用。
- Create: `src/config/repository.ts`
  - 读取、写入、覆盖初始化配置实体。
- Create: `src/config/initialize.ts`
  - 提供 `initializeConfig(db)`，同步配置种子并 fail fast 校验。
- Create: `src/routes/config.ts`
  - 提供只读 `GET /config`。

### 数据库

- Modify: `src/db/schema.sql`
  - 新增或调整 `card_types`、`hook_action_models`。
  - 调整 `statuses`、`transitions`、`hooks` 以符合阶段 2 配置模型。
  - 新增 `card_field_values`。
  - 保留旧列迁移兼容所需的读写计划，最终业务字段以字段值表为准。
- Modify: `src/db/index.ts`
  - `migrate(db)` 后执行配置初始化。

### 卡片后端

- Modify: `src/cards/types.ts`
  - 移除硬编码 `CardType` union 作为业务事实来源，改为字符串类型和配置驱动类型。
  - 增加 `fields` 响应形状。
- Modify: `src/cards/validation.ts`
  - 请求体先归一化为 `{ type, fields, status? }` 或 `{ fields }`。
  - 校验冲突字段、分页、字段过滤查询参数。
- Modify: `src/cards/repository.ts`
  - 读写 `cards` 核心元数据与 `card_field_values`。
  - 组装扁平字段和 `fields` 双响应。
  - 支持类型感知字段过滤。
- Modify: `src/cards/serialize.ts`
  - 从字段值表组装完整 Card 响应。
- Modify: `src/routes/cards.ts`
  - `POST /cards` 读取配置并执行 `create` 动作校验。
  - `PATCH /cards/:id` 读取卡片类型配置并执行 `update` 动作校验。
  - `GET /cards` 支持 `field.<fieldId>` 和兼容别名。

### 前端

- Modify: `web/src/types.ts`
  - 增加配置类型、`fields` 卡片形状。
- Modify/Create: `web/src/api/config.ts`
  - 请求 `GET /config`。
- Modify: `web/src/api/cards.ts`
  - 发送 `{ fields }` 请求体，并兼容读取双响应。
- Modify: `web/src/App.tsx`
  - 启动时加载配置。
  - 把配置传给筛选、新建、详情组件。
- Modify: `web/src/components/NewCardDialog.tsx`
  - 根据选中 card type 的 `create.writableFields` 渲染字段。
- Modify: `web/src/components/CardDrawer.tsx`
  - 根据当前卡类型的 `update.writableFields` 渲染编辑字段。
- Modify: `web/src/components/SidebarFilters.tsx`
  - 使用配置字段构造字段条件列表，保留类型和状态筛选；字段候选展示字段类型，未支持过滤语义的字段可见但不能应用为查询条件。
- Modify: `web/src/components/CardList.tsx`
  - 使用配置字段生成最小可读列表信息；兼容阶段 1 扁平字段，但不把 `title`、`priority`、`assignee` 作为所有业务类型的强制字段。
- Create: `web/src/components/CardPagination.tsx`
  - 渲染显式分页摘要、每页数量和上一页/下一页。

### 测试

- Modify: `tests/http/helpers.ts`
  - 插入卡片时写入核心元数据和字段值表。
  - 提供配置测试 helper。
- Modify: `tests/http/cards.test.ts`
  - 更新阶段 1 兼容行为测试，覆盖阶段 2 新行为。
- Create: `tests/http/config.test.ts`
  - 覆盖配置初始化、读取和 fail fast 引用校验。
- Modify: `tests/e2e/stage1-board.spec.ts`
  - 调整为配置驱动前端仍可完成阶段 1 主路径。
- Create or Modify: `tests/e2e/stage2-config-model.spec.ts`
  - 覆盖配置驱动新建、编辑、字段过滤和错误提示。

### 文档

- Modify: `README.md`
  - 更新当前状态、`GET /config`、字段驱动请求体和人工验收路径。
- Create: `docs/stages/stage-2-basic-config-model/scenario-config-testing-spec.md`
  - 定义阶段 2 场景化配置测试规格。
- Create: `docs/stages/stage-2-basic-config-model/scenario-config-testing-plan.md`
  - 定义补充规格的实施计划。
- Create: `docs/stages/stage-2-basic-config-model/attachments/filter-condition-list-wide-demo.html`
  - 归档配置化筛选条件列表的宽屏布局讨论稿。
- Create: `docs/stages/stage-2-basic-config-model/attachments/filter-condition-list-narrow-demo.html`
  - 归档配置化筛选条件列表的窄屏抽屉布局讨论稿。
- Create: `docs/stages/stage-2-basic-config-model/attachments/filter-condition-list-compact-demo.html`
  - 归档筛选条件列表紧凑版布局讨论稿。

### 场景化配置测试

补充实现以 `scenario-config-testing-spec.md` 为准，至少包含：

- Create: `scenarios/default-sample/`
- Create: `scenarios/custom-review-flow/`
- Create: `scenarios/status-matrix/`
- Create: `scenarios/existing-data-config-change/`
- Create: `scenarios/legacy-stage1-migration/`
- Create: `scenarios/large-dataset-smoke/`
- Create: `scripts/scenario.ts`
- Create: `scripts/scenario-lib.ts`
- Create: `tests/helpers/scenario.ts`
- Modify: `scripts/e2e-server.ts`
- Modify: `.gitignore`
- Modify: `package.json`

## 2. 数据设计

### 2.1 核心配置表

```sql
CREATE TABLE IF NOT EXISTS card_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  fields_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  system INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hook_action_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  schema_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  system INTEGER NOT NULL DEFAULT 0
);
```

`statuses` 调整为配置实体：

```sql
CREATE TABLE IF NOT EXISTS statuses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  position INTEGER NOT NULL,
  color TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  system INTEGER NOT NULL DEFAULT 0
);
```

`transitions` 调整为：

```sql
CREATE TABLE IF NOT EXISTS transitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  card_type TEXT,
  from_status TEXT,
  to_status TEXT NOT NULL,
  writable_fields_json TEXT NOT NULL,
  required_fields_json TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  system INTEGER NOT NULL DEFAULT 0
);
```

`hooks` 阶段 2 存配置骨架：

```sql
CREATE TABLE IF NOT EXISTS hooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  event TEXT NOT NULL,
  match_json TEXT,
  action_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  system INTEGER NOT NULL DEFAULT 0
);
```

### 2.2 卡片和字段值

`cards` 作为核心元数据表：

```sql
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

字段值表：

```sql
CREATE TABLE IF NOT EXISTS card_field_values (
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  field_id TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (card_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_card_field_values_field
  ON card_field_values(field_id);
```

阶段 2 需要为现有数据库执行兼容迁移：

- 从旧 `cards.title/body/options/lane/priority/assignee/reply/replied_by` 读出非空业务字段。
- 写入 `card_field_values`。
- 后续读写以字段值表为准。

SQLite `CREATE TABLE IF NOT EXISTS` 无法直接表达列删除；实施时可采用新表复制或保留旧列但代码不再写入旧列。若选择保留旧列，计划中必须明确旧列不再作为业务事实来源。

## 3. 配置 Schema

### 3.1 FieldDefinition

```ts
type FieldKind =
  | 'text'
  | 'longText'
  | 'number'
  | 'boolean'
  | 'stringList'
  | 'enum'
  | 'actor'
  | 'datetime'
  | 'json';

interface FieldDefinition {
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
  options?: Array<{ value: string; label: string }>;
  validation?: Record<string, unknown>;
  ui?: Record<string, unknown>;
}
```

阶段 2 行为要求：

- `id` 是动作和过滤引用的稳定键。
- `label` 用于错误和前端展示。
- `kind` 用于写入和过滤的类型解析。
- `required`、`defaultValue`、`readOnly`、`storageKey` 参与建卡/编辑校验。
- `enum.options` 用于 enum 写入和过滤校验。

### 3.2 ActionDefinition

```ts
type ActionKind =
  | 'create'
  | 'update'
  | 'reply'
  | 'comment'
  | 'transition'
  | 'system';

interface ActionDefinition {
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
```

阶段 2 行为要求：

- 每个样例 card type 必须有 `create` 和 `update` 动作。
- `writableFields`、`requiredFields` 必须引用同一 card type 中存在的 field。
- disabled action 不参与建卡/编辑。
- `create`、`update` action 驱动后端请求校验和前端表单渲染。

## 4. 接口设计

### 4.1 `GET /config`

返回当前数据库配置：

```json
{
  "cardTypes": [],
  "statuses": [],
  "transitions": [],
  "hookActionModels": [],
  "hooks": []
}
```

要求：

- 只读。
- 返回启用状态和系统标记。
- 返回完整字段定义和动作定义。
- 配置读取前必须经过初始化和引用校验。

### 4.2 `POST /cards`

推荐请求体：

```json
{
  "type": "task",
  "fields": {
    "title": "整理阶段 2 方案",
    "body": "写计划并验证配置驱动",
    "priority": 1,
    "assignee": "human"
  }
}
```

兼容请求体：

```json
{
  "type": "task",
  "title": "整理阶段 2 方案",
  "body": "写计划并验证配置驱动",
  "priority": 1,
  "assignee": "human"
}
```

规则：

- `type` 必须存在于启用的 `card_types`。
- `status` 可选；未传时使用 `default`。显式传入时必须存在于启用的 `statuses`，未知状态返回 400。
- 请求归一化为 `fields` 后执行 `create` action 校验。
- 同一字段同时出现在扁平字段和 `fields` 时返回 400。
- 不在 `create.writableFields` 的字段返回 400。
- `requiredFields` 和字段级 `required` 必须满足。
- 字段值按 `kind` 校验。
- 未传字段使用 `defaultValue`；无默认值则读取为 `null`。
- 成功写入 `cards` 核心行和 `card_field_values`。
- 响应返回双形状 Card。

### 4.3 `PATCH /cards/{id}`

推荐请求体：

```json
{
  "fields": {
    "title": "更新后的标题",
    "priority": 2
  }
}
```

兼容请求体：

```json
{
  "title": "更新后的标题",
  "priority": 2
}
```

规则：

- 读取卡片当前 type，对应 card type 的 `update` action 决定可写字段。
- `status` 不能通过 PATCH 修改。
- 不在 `update.writableFields` 的字段返回 400。
- `readOnly` 字段返回 400。
- 字段值为 `null` 时删除该字段值行。
- 成功更新 `updated_at`。
- 响应返回双形状 Card。

### 4.4 `GET /cards`

保留：

- `type`
- `status`
- `lane`
- `assignee`
- `limit`
- `offset`
- `all=true`

新增：

```text
field.<fieldId>=<value>
```

字段过滤规则：

| kind | 过滤语义 |
|------|----------|
| `text` | 字符串精确匹配 |
| `number` | 数字精确匹配 |
| `boolean` | `true` / `false` 精确匹配 |
| `enum` | 枚举 value 精确匹配 |
| `stringList` | 列表包含字符串 |

错误规则：

- 未知字段返回 400。
- 不支持过滤的字段类型返回 400。
- 值无法按字段 `kind` 解析返回 400。
- enum 值不在 `options` 返回 400。

`lane`、`assignee` 是兼容别名，内部等价于 `field.lane`、`field.assignee`。

### 4.5 Card 响应形状

```ts
interface CardResponse {
  id: string;
  type: string;
  status: string;
  fields: Record<string, unknown>;
  created_by: string;
  created_at: number;
  updated_at: number;

  title: string | null;
  body: string | null;
  options: string[] | null;
  lane: string | null;
  priority: number | null;
  assignee: string | null;
  reply: string | null;
  replied_by: string | null;
}
```

扁平字段从 `fields` 派生，保持阶段 1 兼容。

## 5. 任务拆分

### Task 1: 验证基线

**Files:**
- Read: `AGENTS.md`
- Read: `开发规范.md`
- Read: `docs/roadmap.md`

- [ ] **Step 1: 确认当前分支和工作区**

Run:

```powershell
git status --short --branch
```

Expected: 当前分支不是 `main`。允许看到未跟踪的 `代理执行笔记/`，不要纳入提交。

- [ ] **Step 2: 跑快速测试**

Run:

```powershell
pnpm test
```

Expected: 现有 Vitest 通过。

### Task 2: 建立配置类型、默认场景配置和校验

**Files:**
- Create: `src/config/types.ts`
- Create: `src/config/load-seed.ts`
- Create: `scenarios/default-sample/config.json`
- Create: `src/config/validation.ts`
- Create: `tests/http/config.test.ts`

- [ ] **Step 1: 写配置类型**

Define FieldDefinition、ActionDefinition、CardTypeConfig、StatusConfig、TransitionConfig、HookActionModelConfig、HookConfig、AppConfig.

- [ ] **Step 2: 写默认场景配置**

`scenarios/default-sample/config.json` must include:

- card types: `task`、`decision`、`memo`
- fields: `title`、`body`、`priority`、`lane`、`assignee`、`options`、`reply`、`replied_by`，以及至少一个阶段 1 之外且支持基础过滤的扩展字段，例如 `risk_level`
- actions: `create`、`update`、`reply`、comment/transition placeholders
- statuses: `default`、`active`、`waiting`、`resolved`、`done`
- transitions: `start`、`request_reply`、`submit_reply`、`complete`
- hook action models: `transition`、`webhook`、`script`

- [ ] **Step 3: 写配置校验**

Validate:

- ids are unique.
- card type actions reference existing fields.
- requiredFields are writable or otherwise valid for the action.
- enum fields have valid options.
- transitions reference existing card types and statuses.
- transition writable fields reference fields available to the target card type.
- hook transition actions reference existing transitions.

- [ ] **Step 4: 写失败测试**

Add tests for S2-T2、S2-T3、S2-T4、S2-T6、S2-T7、S2-T8、S2-T14. Every `expect` must include Chinese helper text.

### Task 3: 落库配置模型和初始化

**Files:**
- Modify: `src/db/schema.sql`
- Modify: `src/db/index.ts`
- Create: `src/config/repository.ts`
- Create: `src/config/initialize.ts`
- Modify: `tests/http/config.test.ts`

- [ ] **Step 1: 更新 schema**

Add/adjust config tables and `card_field_values`.

- [ ] **Step 2: 实现 repository**

Implement:

- read current config.
- upsert sample card types/statuses/transitions/hook action models/hooks.
- parse JSON fields safely.

- [ ] **Step 3: 实现 initializeConfig**

Run:

1. load seed config and upsert by id.
2. read current config.
3. validate config.
4. throw on invalid config.

- [ ] **Step 4: 接入 createDb**

After `migrate(db)`, call `initializeConfig(db)`.

- [ ] **Step 5: 测试幂等和覆盖更新**

Cover S2-T1 and S2-T13.

### Task 4: 实现 `GET /config`

**Files:**
- Create: `src/routes/config.ts`
- Modify: `src/app.ts`
- Modify: `tests/http/config.test.ts`

- [ ] **Step 1: 创建配置路由**

`GET /config` returns `{ cardTypes, statuses, transitions, hookActionModels, hooks }`.

- [ ] **Step 2: 挂载路由**

Mount `app.route('/config', configRoute)`.

- [ ] **Step 3: 测试读取接口**

Cover S2-T5.

### Task 5: 迁移卡片存储到字段值表

**Files:**
- Modify: `src/cards/types.ts`
- Modify: `src/cards/serialize.ts`
- Modify: `src/cards/repository.ts`
- Modify: `tests/http/helpers.ts`
- Modify: `tests/http/cards.test.ts`

- [ ] **Step 1: 调整 Card 类型**

Use dynamic string `type` and add `fields: Record<string, unknown>`.

- [ ] **Step 2: 实现字段值读写**

Repository must:

- create cards core row.
- write field values.
- delete field rows for `null`.
- load field values for list/detail.
- derive flat compatibility fields.

- [ ] **Step 3: 更新测试 helper**

`insertCard()` should write `cards` core row and field values.

- [ ] **Step 4: 保持阶段 1 兼容测试**

Existing card API tests should still pass after updating helpers and expected response shape.

### Task 6: 配置驱动建卡和编辑

**Files:**
- Modify: `src/cards/validation.ts`
- Modify: `src/cards/repository.ts`
- Modify: `src/routes/cards.ts`
- Modify: `tests/http/cards.test.ts`

- [ ] **Step 1: 请求体归一化**

Accept `fields` and flat fields. Reject conflicts.

- [ ] **Step 2: 实现 field value validation**

Validate by `kind`:

- text/longText/actor: string or null.
- number: number.
- boolean: boolean.
- stringList: string[].
- enum: string and exists in `options`.
- datetime: number epoch ms or ISO string normalized by implementation choice.
- json: JSON value.

- [ ] **Step 3: 实现 create action 校验**

`POST /cards` uses card type `create` action.

- [ ] **Step 4: 实现建卡 status 校验**

`POST /cards` uses configured statuses. Missing status defaults to `default`; unknown or disabled status returns 400.

- [ ] **Step 5: 实现 update action 校验**

`PATCH /cards/:id` uses card type `update` action.

- [ ] **Step 6: 补测试**

Cover S2-T9、S2-T10、S2-T11、S2-T12、S2-T17、S2-T18.

### Task 7: 实现类型感知字段过滤

**Files:**
- Modify: `src/cards/validation.ts`
- Modify: `src/cards/repository.ts`
- Modify: `tests/http/cards.test.ts`

- [ ] **Step 1: 解析 field filters**

Parse query params matching `field.<fieldId>`.

- [ ] **Step 2: 保留兼容别名**

Map `lane` to `field.lane`; map `assignee` to `field.assignee`.

- [ ] **Step 3: 按 kind 解析过滤值**

Support exact filtering for text/number/boolean/enum and contains for stringList.

- [ ] **Step 4: SQL 查询**

Use joins or `EXISTS` clauses over `card_field_values`. Keep ordering `created_at DESC, id DESC`.

- [ ] **Step 5: 补测试**

Cover S2-T15、S2-T16 and preserve existing list tests. Include filtering by the stage 1 external field such as `risk_level`.

### Task 8: 前端读取配置并动态渲染表单

**Files:**
- Modify: `web/src/types.ts`
- Create: `web/src/api/config.ts`
- Modify: `web/src/api/cards.ts`
- Modify: `web/src/App.tsx`
- Modify: `web/src/components/NewCardDialog.tsx`
- Modify: `web/src/components/CardDrawer.tsx`
- Modify: `web/src/components/SidebarFilters.tsx`
- Modify: `web/src/components/CardList.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: 加载配置**

App startup fetches `/config`. Show an error state if config cannot load.

- [ ] **Step 2: 动态新建表单**

Use selected card type `create.writableFields` and field definitions. Status choices come from configured enabled statuses.

- [ ] **Step 3: 动态编辑表单**

Use selected card type `update.writableFields` and field definitions.

- [ ] **Step 4: 动态字段输入组件**

Support text、longText、number、boolean、stringList、enum.

- [ ] **Step 5: 动态字段条件列表**

Preserve type/status filtering. Field conditions must be added as a list item; field options come from configuration, show field kind, and mark unsupported filter kinds as not supported. Applying filters sends supported `field.<fieldId>` filters only.

- [ ] **Step 6: 配置化列表最小展示**

List rows must not require `title`、`priority` or `assignee`. If a card lacks `title`, show the first readable configured text field as primary text and another readable configured field as secondary text.

- [ ] **Step 7: 显式分页**

Use backend `limit/offset/total` for list pagination. Default to 50 cards per page, support 50/100/200/500 page sizes, and reset to the first page when filters change.

- [ ] **Step 8: 保持宽屏/窄屏功能对位**

The same create/edit/filter capabilities must be reachable in both layouts.

### Task 9: E2E 和文档

**Files:**
- Modify: `tests/e2e/stage1-board.spec.ts`
- Create or Modify: `tests/e2e/stage2-config-model.spec.ts`
- Modify: `README.md`

- [ ] **Step 1: 更新 E2E**

Cover:

- config-driven create.
- config-driven edit.
- field filter.
- create/edit/filter with a stage 1 external configured field.
- read and use a configured status beyond `default`.
- invalid field error.
- wide and narrow layout access.

- [ ] **Step 2: 更新 README**

Document:

- `/config`.
- field-driven request body.
- compatibility with flat request/response fields.
- manual acceptance path.

- [ ] **Step 3: 跑门禁**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm test:e2e
```

Expected: all pass.

## 6. 自动化测试覆盖清单

### 单元或集成测试

- [ ] S2-T1 配置初始化可重复执行，不产生重复数据。
- [ ] S2-T2 卡片类型配置能表达字段能力和动作能力。
- [ ] S2-T3 状态和流转配置能通过引用关系校验。
- [ ] S2-T4 hook 配置骨架能表达事件、匹配条件和动作结构。
- [ ] S2-T6 样例配置包含 `task`、`decision`、`memo`。
- [ ] S2-T7 样例 `decision` 声明正式回复所需字段和动作。
- [ ] S2-T8 样例 hook action model 包含 `transition`、`webhook`、`script`。
- [ ] S2-T13 同 id 配置种子再次初始化时覆盖更新。
- [ ] S2-T14 配置引用无效时初始化失败。

### HTTP 集成测试

- [ ] S2-T5 `GET /config` 返回卡片类型、状态、流转和 hook 动作模型。
- [ ] S2-T9 `POST /cards` 只接受当前配置中存在且启用的卡片类型。
- [ ] S2-T10 `POST /cards` 只写入 `create` 动作允许字段。
- [ ] S2-T11 `PATCH /cards/{id}` 只写入 `update` 动作允许字段。
- [ ] S2-T12 `options` 是否可写由配置决定。
- [ ] S2-T15 `GET /cards` 支持 `field.<fieldId>=<value>` 基础过滤。
- [ ] S2-T16 字段过滤遇到未知字段、不可过滤类型或解析失败时返回 400。
- [ ] S2-T17 样例配置中的阶段 1 之外字段可以随建卡写入、随编辑更新，并出现在 `fields` 响应中。
- [ ] S2-T18 样例配置中的阶段 1 之外状态可被读取并用于建卡；未知状态返回 400。

### 前端或端到端测试

- [ ] 页面启动后读取 `/config`。
- [ ] 新建表单由 `create` action 渲染。
- [ ] 编辑表单由 `update` action 渲染。
- [ ] 页面可创建 `task`、`decision`、`memo`。
- [ ] 页面可编辑配置允许字段。
- [ ] 页面可按配置字段过滤。
- [ ] 筛选条件选择器展示字段类型；未支持过滤语义的字段可见并带“暂未支持”标识。
- [ ] 无 `title`、`priority`、`assignee` 的业务类型仍能在列表中显示可读主信息和副信息。
- [ ] 大量数据场景可通过显式分页访问默认前 50 张之后的数据。
- [ ] 页面可创建、编辑并过滤阶段 1 之外的配置字段。
- [ ] 页面可读取并使用阶段 1 之外的配置状态。
- [ ] 宽屏和窄屏布局均可完成新建、编辑、筛选和错误查看。
- [ ] 场景化测试覆盖 default-sample、custom-review-flow、status-matrix、existing-data-config-change、legacy-stage1-migration、large-dataset-smoke。
- [ ] 非默认场景能证明前端表单不是写死默认样例字段。
- [ ] 场景工具能准备和复制稳定数据库，E2E 不污染 prepared db。

## 7. 人工验收指南

阶段 2 人工验收应以“能力声明和可观察证据”为核心，不把用户限制为一套固定点击流程。推荐入口：

1. `pnpm scenario:list`
2. `pnpm scenario:start <场景 id> [--port N] [--fresh]`
3. 阅读场景 `README.md`，了解该场景包含什么配置、什么初始数据、适合观察什么能力。

必须可观察的能力：

- 默认样例配置可用。
- 非默认配置能改变前端表单、后端校验和字段过滤。
- 状态配置能影响建卡状态选择和状态筛选。
- 已有数据后配置变化不会破坏历史字段读取。
- 阶段 1 旧库能迁移并保持 API/前端可用。
- 1000 张卡场景下分页和基础过滤仍可用。
- 宽屏和窄屏布局均可完成核心能力观察。

## 8. 提交拆分建议

1. `文档: 更新阶段二配置模型路线`
   - 仅包含 `docs/roadmap.md` 的阶段 2 范围补充。
2. `功能: 建立阶段二配置模型`
   - 配置类型、默认场景配置、配置表、初始化、校验、`GET /config`。
3. `重构: 迁移卡片字段值存储`
   - `cards` 核心元数据、`card_field_values`、序列化和兼容响应。
4. `功能: 使用配置驱动卡片读写`
   - `POST /cards`、`PATCH /cards/:id`、字段过滤。
5. `功能: 前端接入配置驱动表单`
   - `/config` 前端读取、动态新建/编辑/筛选、E2E。
6. `文档: 更新阶段二使用说明`
   - README 和人工验收说明。

如果拆分时某个提交只包含测试文件，提交类型用 `测试`；只包含构建脚本或依赖时用 `构建`。提交信息必须遵守 AGENTS.md。

## 9. 阶段完成定义

阶段 2 完成必须同时满足：

- 配置表、样例配置、初始化和 fail fast 校验落地。
- `GET /config` 返回完整配置。
- `POST /cards` 和 `PATCH /cards/{id}` 使用配置 action 校验字段。
- 卡片业务字段读写走 `card_field_values`。
- API 响应包含 `fields` 并保留阶段 1 扁平字段兼容。
- 请求体接受 `fields` 和兼容扁平字段，冲突字段返回 400。
- `GET /cards` 支持类型感知字段过滤。
- 样例配置包含至少一个阶段 1 之外字段，且该字段可被创建、编辑、读取和过滤。
- 样例配置包含阶段 1 之外状态，且该状态可被读取并用于建卡校验。
- 前端使用 `/config` 渲染新建、编辑和筛选。
- 前端字段筛选使用条件列表，字段选项来自配置并展示字段类型；未支持过滤语义的字段可见且不会生成查询条件。
- 卡片列表不强制依赖 `title`、`priority`、`assignee`；非默认场景可在无这些字段时显示配置字段摘要。
- 卡片列表提供显式分页，large-dataset-smoke 的 1000 张卡可通过翻页访问。
- S2-T1 到 S2-T18 均有自动化测试覆盖。
- `scenario-config-testing-spec.md` 中定义的 6 个场景全部落地。
- 默认配置来自 `scenarios/default-sample/config.json`，且指定 `CONFIG_SEED_PATH` 可切换配置种子。
- 场景 CLI 支持 list、prepare、start、copy-db。
- 生成数据库被 `.gitignore` 忽略，prepared db 不被 E2E 污染。
- 自动化测试覆盖 S2-T19 到 S2-T25。
- 宽屏和窄屏 E2E 覆盖新建、编辑、筛选和错误提示。
- `pnpm test`、`pnpm typecheck`、`pnpm test:e2e` 通过。
- `pnpm build:web` 通过。
- `pnpm scenario:list`、`pnpm scenario:prepare default-sample`、`pnpm scenario:copy-db custom-review-flow .tmp/scenarios/custom-review-flow.verify.db` 通过。
- README 与实际行为一致。
- `git status --short` 中不包含误提交的 `data/`、`代理执行笔记/` 等本地资料。

## 10. 自查记录

- 路线图 S2-F1 到 S2-F13 均有任务覆盖。
- 路线图 S2-T1 到 S2-T25 均进入测试清单。
- 路线图 S2-H1 到 S2-H8 均进入人工验收指南。
- 计划没有修改阶段 1 历史计划文档。
- 后续阶段要求以 `docs/roadmap.md` 为准，未写入本阶段计划作为未来提醒。
- 配置化筛选条件列表的宽屏和窄屏 HTML 讨论稿已归档到阶段 2 `attachments/`。
- 配置化筛选条件列表紧凑版 HTML 讨论稿已归档到阶段 2 `attachments/`。
