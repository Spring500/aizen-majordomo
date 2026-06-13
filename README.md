# aizen-majordomo

自托管的本地看板系统，同时服务人类与任意 AI agent：人类用作个人备忘与对 agent 的指挥/审批界面，agent 用作任务协作与向人类发起异步确认（决策卡）。

> 当前具备阶段 2 基础配置模型：Hono API、SQLite 持久化、React 前端、配置初始化和读取、配置驱动的新建/编辑/筛选、字段值表存储、阶段 1 API 兼容响应，以及 Vitest + Playwright 验收。鉴权、状态流转执行、changes、评论和 hook 运行器尚未实现。

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
│  ├─ config/             # 配置类型、样例、校验、初始化、repository
│  └─ routes/
│     ├─ cards.ts         # 配置驱动卡片 API：创建、列表、读取、编辑
│     └─ config.ts        # GET /config
├─ tests/http/            # HTTP 行为验收（Vitest + app.request）
├─ tests/e2e/             # Playwright 浏览器验收
├─ web/                   # React + Vite 前端
├─ scripts/               # 提交校验等工具脚本
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

## 开发规范

提交信息格式与开发工作流（worktree、两段式测试门禁、落地方式）见 [开发规范.md](开发规范.md)，由 husky hook 本地强制校验。AI agent 另见 [AGENTS.md](AGENTS.md)。

## 数据库

启动时自动执行 `src/db/schema.sql`（全部 `CREATE TABLE IF NOT EXISTS`，可重复运行）。运行时配置以 SQLite 为事实来源，启动时用内置样例配置按同 id 覆盖初始化并 fail fast 校验。

核心表包括：

- `card_types`、`statuses`、`transitions`、`hook_action_models`、`hooks`：配置实体。
- `cards`：卡片核心元数据和状态。
- `card_field_values`：业务字段值，统一以 JSON 存储。
- `comments`、`changes`、`roles`、`tokens`、`sessions`、`settings`：后续能力预留表。

已开启 WAL 以满足并发读写的原子性要求。

## 阶段 2 人工验收

1. 删除或更换本地 `DB_PATH`，从空库启动。
2. 打开 `http://127.0.0.1:3000/config`，确认返回 `task`、`decision`、`memo`、状态、流转和 hook action model。
3. 打开前端首页，看到空状态，且新建表单类型来自配置。
4. 创建一张 task，填写标题、正文、优先级、负责人和风险等级。
5. 创建一张 decision，填写标题、正文和 options，详情抽屉能看到 options。
6. 创建一张 memo，类型显示正确。
7. 刷新页面，已创建卡片仍然存在。
8. 打开 task 详情，修改标题、正文、优先级、负责人和风险等级，保存后刷新仍存在。
9. 使用风险等级筛选，列表只显示目标字段值的卡片。
10. 创建或查看一张使用 `active` 等非默认状态的卡片。
11. 尝试创建空标题卡片，页面显示“标题不能为空”。
12. 传入未知 card type、未知状态、未授权字段或非法字段过滤值，确认返回明确错误。
13. 收窄浏览器，重复新建、编辑、筛选和错误查看路径。

## 后续路线图（未实现）

- 人类登录与会话（`/login`、`/logout`，argon2 + Cookie）
- 令牌鉴权中间件（`Authorization: Bearer`）与 RBAC scope 校验
- 状态流转校验链（`POST /cards/{id}/transition`、`/reply`）
- 评论（`/comments`）与增量变更（`/changes?since=`）
- 出站 hook 运行器
- 看板体验增强（搜索、快捷筛选、管理界面、回复视图）

详见 `docs/` 下的规格说明。
