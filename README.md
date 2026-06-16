# aizen-majordomo

自托管的本地看板系统，同时服务人类与任意 AI agent：人类用作个人备忘与对 agent 的指挥/审批界面，agent 用作任务协作与向人类发起异步确认（决策卡）。

> 当前具备阶段 2 基础配置模型：Hono API、SQLite 持久化、React 前端、配置初始化和读取、配置驱动的新建/编辑/筛选、字段值表存储、阶段 1 API 兼容响应、场景化配置测试，以及 Vitest + Playwright 验收。鉴权、状态流转执行、changes、评论和 hook 运行器尚未实现。

## 技术栈

| 项 | 选型 |
|---|---|
| 运行时 | Node.js ≥ 22.5（TypeScript，ESM） |
| 存储 | SQLite（`node:sqlite` 内置驱动，WAL） |
| 后端框架 | Hono + `@hono/node-server` |
| 前端 | React + Vite |
| 校验 | zod |
| 密码哈希 | `@node-rs/argon2`（预留给后续登录功能） |
| 验收 | Vitest + Playwright |
| 包管理器 | pnpm |

## 环境要求

- **Node.js ≥ 22.5**（`node:sqlite` 自 22.5 起提供，仍为 experimental）。检查：`node --version`。
- **pnpm**（建议 ≥ 11）。检查：`pnpm --version`；未安装可 `npm i -g pnpm`。
- 操作系统：Windows / macOS / Linux 均可。

## 安装

```bash
pnpm install
```

首次安装时 pnpm 会询问是否允许 `esbuild`（tsx 的依赖）执行构建脚本。本仓库已在 `pnpm-workspace.yaml` 中预先批准，无需手动操作：

```yaml
allowBuilds:
  esbuild: true
verifyDepsBeforeRun: false   # 关闭 pnpm 跑脚本前的依赖校验，避免审批提示误报
```

## 配置

通过环境变量配置，均为可选：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | HTTP 监听端口 |
| `DB_PATH` | `data/majordomo.db` | SQLite 数据库文件路径（首次启动自动创建目录与库，并执行建表） |
| `CONFIG_SEED_PATH` | `scenarios/default-sample/config.json` | 初始化配置种子 JSON；运行时配置仍以 SQLite 为事实来源 |

示例：

```bash
PORT=8080 DB_PATH=./data/dev.db pnpm start
```

> `node:sqlite` 目前需 `--experimental-sqlite` 标志，已写进 `dev` / `start` 脚本，无需手动加。

## 启动

开发模式（文件变更自动重启）：

```bash
pnpm dev
```

普通启动：

```bash
pnpm start
```

启动后控制台输出：

```
aizen-majordomo listening on http://localhost:3000
```

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

## 验证

```bash
# 健康检查
curl http://localhost:3000/health
# {"status":"ok","name":"aizen-majordomo","time":<epoch_ms>}

# 读取运行时配置
curl http://localhost:3000/config
# {"cardTypes":[...],"statuses":[...],"transitions":[...],"hookActionModels":[...],"hooks":[...]}

# 列卡
curl http://localhost:3000/cards
# {"cards":[],"total":0}
```

推荐使用字段驱动请求体创建卡片：

```bash
curl -X POST http://localhost:3000/cards \
  -H "Content-Type: application/json" \
  -d '{"type":"task","status":"active","fields":{"title":"整理阶段 2","body":"验证配置驱动","priority":1,"risk_level":"high"}}'
```

阶段 1 的扁平字段请求仍兼容：

```bash
curl -X POST http://localhost:3000/cards \
  -H "Content-Type: application/json" \
  -d '{"type":"task","title":"兼容建卡","body":"仍可使用扁平字段"}'
```

响应同时包含 `fields` 和阶段 1 扁平字段。若同一字段同时出现在 `fields` 与扁平字段中，请求会返回 400。

字段过滤使用 `field.<fieldId>`：

```bash
curl "http://localhost:3000/cards?field.risk_level=high"
```

前端筛选面板使用字段条件列表。点击“添加筛选条件”后，字段候选来自当前配置，并显示字段类型；阶段 2 尚未支持过滤语义的字段会显示“暂未支持”，不会被应用为查询条件。

卡片列表使用显式分页，不使用无限滚动。默认每页 50 张，可切换到 100、200 或 500 张；筛选条件变化后回到第一页。
工作台固定在浏览器视口内，顶部栏、左右控制栏和分页栏保持可见；大量卡片时只有中间卡片列表区域独立滚动。

类型检查：

```bash
pnpm typecheck
```

端到端验收：

```bash
pnpm test:e2e
```

## 目录结构

```
aizen-majordomo/
├─ src/
│  ├─ index.ts            # 入口：createDb + createApp + serve
│  ├─ app.ts              # createApp(db)：组装 Hono、注入 db、挂载路由
│  ├─ types.ts            # 共享类型（AppEnv 等）
│  ├─ db/
│  │  ├─ index.ts         # createDb(path)：连接(WAL/外键)+建表，支持 :memory:
│  │  └─ schema.sql       # 配置表、卡片核心表、字段值表与索引（幂等建表）
│  ├─ config/             # 配置类型、JSON seed loader、校验、初始化、repository
│  └─ routes/
│     ├─ cards.ts         # 配置驱动卡片 API：创建、列表、读取、编辑
│     └─ config.ts        # GET /config
├─ tests/http/            # HTTP 行为验收（Vitest + app.request）
├─ tests/e2e/             # Playwright 浏览器验收
├─ scenarios/             # 默认配置和阶段 2 多场景配置资产
├─ web/                   # React + Vite 前端
├─ scripts/               # 提交校验、E2E 服务、场景 CLI 等工具脚本
├─ .husky/                # git hook（commit-msg / pre-commit / pre-merge-commit）
├─ data/                  # 运行时生成的 SQLite 文件（已 gitignore）
├─ docs/                  # 设计文档（暂不入库）
├─ 开发规范.md            # 提交信息规范 + 开发工作流（单一事实源）
├─ AGENTS.md              # 面向 AI agent 的协作约定
├─ package.json
├─ pnpm-workspace.yaml
├─ vitest.config.ts
└─ tsconfig.json
```

## 脚本

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 开发模式启动（`--watch` 热重启） |
| `pnpm dev:web` | 启动 Vite React 前端开发服务 |
| `pnpm build:web` | 构建 React 前端到 `web/dist` |
| `pnpm start` | 启动服务 |
| `pnpm test` | 跑全部快速 Vitest（单元 + HTTP 验收） |
| `pnpm test:watch` | Vitest 监听模式（红绿循环用） |
| `pnpm test:e2e` | Playwright 端到端验收 |
| `pnpm typecheck` | TypeScript 类型检查（不产出文件） |
| `pnpm scenario:list` | 列出阶段 2 场景 |
| `pnpm scenario:prepare <id>` | 生成场景 prepared db |
| `pnpm scenario:start <id> [--port N] [--fresh]` | 启动场景供人工观察 |
| `pnpm scenario:copy-db <id> <target>` | 复制稳定场景数据库给临时测试或 E2E |

### 场景命令说明

场景数据库分两层：

- `prepared db`：场景的基准数据库，路径为 `data/scenarios/<id>.prepared.db`。它由场景配置和 seed 生成，作为稳定模板使用。
- `runtime db`：实际启动服务时使用的数据库，默认路径为 `data/scenarios/<id>.runtime.db`。服务运行期间的新增、编辑只影响 runtime db，不会污染 prepared db。

命令行为：

- `pnpm scenario:list`：列出可用场景。
- `pnpm scenario:prepare <id>`：重新生成该场景的 prepared db。适合在修改场景配置或 seed 后使用。
- `pnpm scenario:start <id>`：如果 prepared db 不存在，先 prepare；然后复制一份 runtime db 并启动服务。
- `pnpm scenario:start <id> --fresh`：无论 prepared db 是否已经存在，都先重新 prepare，再复制 runtime db 并启动服务。适合希望确认当前场景源文件已经完全生效时使用。
- `pnpm scenario:start <id> --port N`：使用指定端口启动。显式传入端口时，runtime db 会改为 `data/scenarios/<id>.port<N>.runtime.db`，因此可以同时打开多个场景或同一场景的多个端口。
- `pnpm scenario:copy-db <id> <target>`：把 prepared db 复制到目标路径，供临时测试或 E2E 使用；如果 prepared db 不存在，会先 prepare。

简单说：修改了场景源文件，用 `--fresh`；只是想重新打开一个可操作的观察环境，不需要 `--fresh`。

## 开发规范

提交信息格式与开发工作流（worktree、两段式测试门禁、落地方式）见 [开发规范.md](开发规范.md)，由 husky hook 本地强制校验。AI agent 另见 [AGENTS.md](AGENTS.md)。

## 数据库

启动时自动执行 `src/db/schema.sql`（全部 `CREATE TABLE IF NOT EXISTS`，可重复运行）。运行时配置以 SQLite 为事实来源，启动时用 JSON 配置种子按同 id 覆盖初始化并 fail fast 校验。默认种子来自 `scenarios/default-sample/config.json`。

核心表包括：

- `card_types`、`statuses`、`transitions`、`hook_action_models`、`hooks`：配置实体。
- `cards`：卡片核心元数据和状态。
- `card_field_values`：业务字段值，统一以 JSON 存储。
- `comments`、`changes`、`roles`、`tokens`、`sessions`、`settings`：后续能力预留表。

已开启 WAL 以满足并发读写的原子性要求。

## 阶段 2 人工验收

人工验收以场景为入口，场景 README 说明该场景包含什么、适合观察什么：

```bash
pnpm scenario:list
pnpm scenario:start <场景 id> [--port N] [--fresh]
```

阶段 2 提供 6 个场景：`default-sample`、`custom-review-flow`、`status-matrix`、`existing-data-config-change`、`legacy-stage1-migration`、`large-dataset-smoke`。它们分别用于观察默认配置、自定义非默认配置、状态矩阵、已有数据后的配置变化、阶段 1 旧库迁移和 1000 张卡冒烟规模。

其中 `custom-review-flow` 不包含 `title`、`priority`、`assignee`、`risk_level` 等默认样例字段，可用于观察前端表单、筛选条件和列表摘要确实来自场景配置。

## 后续路线图（未实现）

- 人类登录与会话（`/login`、`/logout`，argon2 + Cookie）
- 令牌鉴权中间件（`Authorization: Bearer`）与 RBAC scope 校验
- 状态流转校验链（`POST /cards/{id}/transition`、`/reply`）
- 评论（`/comments`）与增量变更（`/changes?since=`）
- 出站 hook 运行器
- 看板体验增强（搜索、快捷筛选、管理界面、回复视图）

详见 `docs/` 下的规格说明。
