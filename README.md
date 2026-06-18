# aizen-majordomo

自托管的本地看板系统，同时服务人类与 AI agent。

人类用网页处理事项和回复决策，agent 通过 API、changes 事件流和配套交付物参与异步协作。

## 当前状态

当前已具备阶段 3 人机决策闭环 MVP：

- Hono API、SQLite 持久化和 React 前端。
- 配置驱动的卡片类型、字段、状态、流转和 hook 动作模型。
- changes 事件流和 decision reply action。
- 面向 agent 实战协作的独立场景、skill 和 CLI。

尚未实现：

- 人类登录与会话。
- agent token 与 RBAC scope。
- 强状态流转执行。
- 评论与协作上下文。
- hook 运行器和外部集成。

## 快速开始

### 环境要求

- Node.js >= 22.5
- pnpm >= 11
- Windows / macOS / Linux

### 安装

```bash
pnpm install
```

### 开发期启动

开发期通常启动两个服务：

```bash
pnpm dev
pnpm dev:web
```

- API: `http://127.0.0.1:3000`
- 前端开发服务: `http://127.0.0.1:5173`

### 本地使用启动

```bash
pnpm build:web
pnpm start
```

然后打开 `http://127.0.0.1:3000`。

## 推荐体验路径

从 agent 实战协作场景开始：

```bash
pnpm scenario:start agent-board-config --fresh
```

然后打开命令输出中的前端地址，观察以下闭环：

- agent 可创建 `status=waiting` 的 `decision`。
- 人类可在网页中看到等待回复的 `decision`。
- 人类提交正式回复后，回复字段可读取，changes 中有回复事件。

更多说明见 [agent-kit/configs/agent-board-config/README.md](agent-kit/configs/agent-board-config/README.md)。

## 当前能力

- 通过网页创建、查看、编辑卡片和回复 decision。
- 通过配置定义卡片类型、字段、状态、流转和 hook 动作模型。
- 使用 SQLite 保存运行时数据和配置。
- 使用场景配置体验不同卡片模型和大量数据。
- 已包含面向 agent 协作的配置、skill 和 CLI 交付物。

## 配置

常用环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 监听端口 |
| `DB_PATH` | `data/majordomo.db` | SQLite 数据库文件路径 |
| `CONFIG_SEED_PATH` | `scenarios/default-sample/config.json` | 初始化配置种子 |

`CONFIG_SEED_PATH` 只用于初始化新数据库；已有数据库不会被 JSON 自动覆盖。

示例：

```bash
PORT=8080 DB_PATH=./data/dev.db pnpm start
```

### 数据文件与备份

运行时数据默认保存在 `data/majordomo.db`。备份时停止服务，复制 `DB_PATH` 指向的 SQLite 数据库文件及其同名 `-wal`、`-shm` 文件。

## 快速验证

健康检查：

```bash
curl http://localhost:3000/health
```

## 场景体验

内置场景：

- `default-sample`
- `custom-review-flow`
- `status-matrix`
- `existing-data-config-change`
- `legacy-stage1-migration`
- `large-dataset-smoke`
- `agent-board-config`

```bash
pnpm scenario:list
pnpm scenario:start <场景 id> [--port N] [--fresh]
```

- 修改了场景源文件时使用 `--fresh`。
- 只想重新打开一个可操作的观察环境时，不需要 `--fresh`。
- 显式传入 `--port N` 时会使用独立 runtime db，方便同时观察多个场景。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 启动 Hono API |
| `pnpm dev:web` | 启动 Vite 前端开发服务 |
| `pnpm build:web` | 构建前端 |
| `pnpm start` | 启动服务 |
| `pnpm test` | 运行快速 Vitest |
| `pnpm test:e2e` | 运行 Playwright 验收 |
| `pnpm typecheck` | TypeScript 类型检查 |

## Agent 接入

agent 相关交付物位于 `agent-kit/`：

- `agent-kit/configs/agent-board-config/`：实战协作场景配置。
- `agent-kit/skills/majordomo/`：面向 agent 的 skill、参考文档和 CLI 脚本。

当前阶段还没有 token 鉴权。agent 接入按本地可信环境处理，后续会补充 token、scope 和 RBAC。

## 项目结构

```text
aizen-majordomo/
├─ agent-kit/            # 面向 agent 的配置、skill 和 CLI
├─ src/                  # Hono API、SQLite、配置和路由
├─ web/                  # React + Vite 前端
├─ tests/                # Vitest 和 Playwright 测试
├─ scenarios/            # 场景配置和场景说明
├─ scripts/              # 提交校验、场景 CLI、E2E 辅助
├─ docs/                 # 路线图、阶段计划和设计资料
├─ CONTRIBUTING.md       # 开发、提交、PR 和 CI 规则
└─ AGENTS.md             # AI agent 快速协作规则
```

## 开发与路线图

- 开发、提交、测试和 PR 规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。
- AI agent 必须先读 [AGENTS.md](AGENTS.md)。
- 产品路线和阶段验收基线见 [docs/ROADMAP.md](docs/ROADMAP.md)。
