# 开发者说明

本文记录开发、测试、场景和数据库细节。普通使用入口见仓库根目录 `README.md`。

## 技术栈

| 项 | 选型 |
|---|---|
| 运行时 | Node.js >= 22.5，TypeScript，ESM |
| 存储 | SQLite，`node:sqlite` 内置驱动，WAL |
| 后端框架 | Hono + `@hono/node-server` |
| 前端 | React + Vite |
| 校验 | zod |
| 验收 | Vitest + Playwright |
| 包管理器 | pnpm |

`node:sqlite` 需要 `--experimental-sqlite`，相关脚本已内置该参数。

## 前端开发

开发期通常同时启动两个服务：

```bash
pnpm dev
pnpm dev:web
```

- 后端默认 `http://127.0.0.1:3000`
- Vite 前端默认 `http://127.0.0.1:5173`

正式本地使用：

```bash
pnpm build:web
pnpm start
```

## 目录结构

```text
aizen-majordomo/
├─ src/                 # Hono API、SQLite、配置和卡片领域代码
├─ web/                 # React + Vite 前端
├─ tests/http/          # HTTP 行为测试
├─ tests/web/           # 前端组件级测试
├─ tests/e2e/           # Playwright 验收
├─ tests/scenario/      # 场景工具测试
├─ scenarios/           # 默认配置和阶段 2 测试场景
├─ agent-kit/           # agent 配置、skill、CLI 和 references
├─ scripts/             # 场景 CLI、提交校验、E2E 服务等
├─ docs/                # 路线图、阶段设计和开发文档
├─ data/                # 运行时生成的 SQLite 文件，已 gitignore
├─ 开发规范.md
└─ AGENTS.md
```

## 脚本

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 开发模式启动后端 |
| `pnpm dev:web` | 启动 Vite 前端开发服务 |
| `pnpm build:web` | 构建 React 前端 |
| `pnpm start` | 启动服务 |
| `pnpm majordomo` | 运行 agent kit CLI |
| `pnpm test` | 跑全部快速 Vitest |
| `pnpm test:watch` | Vitest 监听模式 |
| `pnpm test:e2e` | Playwright 端到端验收 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm scenario:list` | 列出场景 |
| `pnpm scenario:prepare <id>` | 生成场景 prepared db |
| `pnpm scenario:start <id> [--port N] [--fresh]` | 启动场景 |
| `pnpm scenario:copy-db <id> <target>` | 复制场景数据库 |

## 场景系统

场景源文件来自两个位置：

```text
scenarios/
agent-kit/configs/
```

阶段 2 的 `default-sample`、`custom-review-flow` 等场景用于验证配置化基建。阶段 3 的 `agent-board-config` 是面向 agent 实战协作的独立配置资产。

场景数据库分两层：

- `prepared db`：稳定基准库，路径为 `data/scenarios/<id>.prepared.db`。
- `runtime db`：启动服务时复制出的运行库，默认路径为 `data/scenarios/<id>.runtime.db`。

常用命令：

```powershell
pnpm scenario:list
pnpm scenario:prepare agent-board-config
pnpm scenario:start agent-board-config --fresh
```

修改场景源文件后使用 `--fresh` 重新准备基准库。

## 数据库

启动时执行 `src/db/schema.sql`。核心表：

- `card_types`、`statuses`、`transitions`、`hook_action_models`、`hooks`：配置实体。
- `cards`：卡片核心元数据和状态。
- `card_field_values`：业务字段值，统一 JSON 存储。
- `changes`：agent 可消费的事件流，使用 `seq` 作为游标。
- `comments`、`roles`、`tokens`、`sessions`、`settings`：后续阶段预留或待完善。

阶段 3 的 `changes` 事件至少包括：

- `card.created`
- `card.updated`
- `card.action.reply`

## 测试要求

新增或修改测试时，每个 `expect` 都必须带中文辅助信息。

常规验证顺序：

```powershell
pnpm test
pnpm typecheck
pnpm build:web
pnpm test:e2e
```

分支提交会通过 husky 跑快速 Vitest。落地 `main` 前应跑全量门禁。

## 开发工作流

日常开发必须在分支或 worktree 中进行，不在 `main` 直接开发。

提交信息和落地方式见：

- [开发规范.md](../开发规范.md)
- [AGENTS.md](../AGENTS.md)
