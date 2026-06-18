# aizen-majordomo

自托管的本地看板系统，同时服务人类与 AI agent。人类用网页处理事项和回复决策，agent 通过 CLI 创建 decision、等待人类回复，并用 changes 事件流恢复上下文。

当前已具备阶段 3 人机决策闭环 MVP：Hono API、SQLite 持久化、React 前端、配置驱动卡片模型、changes 事件流、reply action、独立 agent board 配置，以及配套 agent skill + CLI。认证、强状态流转、评论和 hook 运行器尚未实现。

## 当前能力

- 通过网页创建、查看、编辑卡片。
- 通过配置定义卡片类型、字段、状态、流转和 hook 动作模型。
- 使用 SQLite 保存运行时数据和配置。
- 使用场景配置体验不同卡片模型和大量数据。
- 通过 GitHub PR + CI 保护 `main`，本地 hook 提供提前反馈。
- agent 可通过 CLI 创建 decision、等待人类正式回复，并用 changes 事件流恢复状态。

## 环境要求

- Node.js >= 22.5
- pnpm >= 11
- Windows / macOS / Linux

## 安装

```bash
pnpm install
```

## 启动

开发期通常启动两个服务：

```bash
pnpm dev
pnpm dev:web
```

- API: `http://127.0.0.1:3000`
- 前端开发服务: `http://127.0.0.1:5173`

正式本地使用：

```bash
pnpm build:web
pnpm start
```

然后打开 `http://127.0.0.1:3000`。

## 配置

常用环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | HTTP 监听端口 |
| `DB_PATH` | `data/majordomo.db` | SQLite 数据库文件路径 |
| `CONFIG_SEED_PATH` | `scenarios/default-sample/config.json` | 初始化配置种子 |

运行时配置以 SQLite 为事实来源。JSON 配置只作为初始化种子。

示例：

```bash
PORT=8080 DB_PATH=./data/dev.db pnpm start
```

## 基础 API

健康检查：

```bash
curl http://localhost:3000/health
```

读取配置：

```bash
curl http://localhost:3000/config
```

列出卡片：

```bash
curl http://localhost:3000/cards
```

创建卡片：

```bash
curl -X POST http://localhost:3000/cards \
  -H "Content-Type: application/json" \
  -d '{"type":"task","status":"active","fields":{"title":"整理阶段 2","body":"验证配置驱动","priority":1,"risk_level":"high"}}'
```

字段过滤：

```bash
curl "http://localhost:3000/cards?field.risk_level=high"
```

创建等待回复 decision：

```bash
curl -X POST http://localhost:3000/cards \
  -H "Content-Type: application/json" \
  -H "X-Actor: agent" \
  -d '{"type":"decision","status":"waiting","fields":{"title":"是否采用方案 A？","options":["采用 A","采用 B"]}}'
```

为 decision 提交正式回复：

```bash
curl -X POST http://localhost:3000/cards/<card-id>/actions/reply \
  -H "Content-Type: application/json" \
  -H "X-Actor: human" \
  -d '{"fields":{"reply":"采用方案 A","replied_by":"human"}}'
```

读取 changes：

```bash
curl "http://localhost:3000/changes?since=0"
```

## Agent Kit

Agent 协作配置、skill 和 CLI 位于：

```text
agent-kit/
```

常用流程：

```powershell
pnpm majordomo ask --title "是否采用方案 A？" --body "请确认。" --option "采用 A" --option "采用 B"
pnpm majordomo wait-reply --card-id <上一步输出的 card id>
```

复杂输入使用 stdin JSON：

```powershell
pnpm majordomo ask --stdin < decision.json
```

人类回复可能间隔很长，`wait-reply` 不设置超时。

Agent 实战看板配置可作为场景启动：

```powershell
pnpm scenario:start agent-board-config --fresh
```

## 场景体验

阶段 2 提供 6 个场景：`default-sample`、`custom-review-flow`、`status-matrix`、`existing-data-config-change`、`legacy-stage1-migration`、`large-dataset-smoke`。阶段 3 新增面向 agent 实战协作的 `agent-board-config`。

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
| `pnpm majordomo ask` | 创建等待人类回复的 decision |
| `pnpm majordomo wait-reply --card-id <id>` | 等待并读取人类正式回复 |
| `pnpm test` | 运行快速 Vitest |
| `pnpm test:e2e` | 运行 Playwright 验收 |
| `pnpm typecheck` | TypeScript 类型检查 |

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
- 阶段 3 设计见 [docs/stages/stage-3-agent-decision-loop/design.md](docs/stages/stage-3-agent-decision-loop/design.md)。
- 阶段 3 实施计划见 [docs/stages/stage-3-agent-decision-loop/plan.md](docs/stages/stage-3-agent-decision-loop/plan.md)。

## 后续方向

- 人类登录与会话
- agent token 与 RBAC scope
- 状态流转执行
- 评论与协作上下文
- hook 执行器和外部集成
- 管理界面、搜索、备份说明和体验打磨
