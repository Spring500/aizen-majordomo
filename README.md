# aizen-majordomo

自托管的本地看板系统，同时服务人类与 AI agent。人类用网页处理事项和回复决策，agent 通过 CLI 创建 decision、等待人类回复，并用 changes 事件流恢复上下文。

> 当前具备阶段 3 人机决策闭环 MVP：Hono API、SQLite 持久化、React 前端、配置驱动卡片模型、changes 事件流、reply action、独立 agent board 配置，以及配套 agent skill + CLI。认证、强状态流转、评论和 hook 运行器尚未实现。

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

默认地址：

```text
http://127.0.0.1:3000
```

## 配置

常用环境变量：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | HTTP 监听端口 |
| `DB_PATH` | `data/majordomo.db` | SQLite 数据库文件路径 |
| `CONFIG_SEED_PATH` | `scenarios/default-sample/config.json` | 初始化配置种子 JSON |

运行时配置以 SQLite 为事实来源。JSON 配置只作为初始化种子。

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

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 启动 Hono API |
| `pnpm dev:web` | 启动 Vite 前端开发服务 |
| `pnpm build:web` | 构建 React 前端 |
| `pnpm start` | 启动服务 |
| `pnpm majordomo ask` | 创建等待人类回复的 decision |
| `pnpm majordomo wait-reply --card-id <id>` | 等待并读取人类正式回复 |
| `pnpm scenario:list` | 列出可用场景 |
| `pnpm scenario:start <id> [--fresh]` | 启动指定场景 |
| `pnpm test` | 跑快速 Vitest |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm test:e2e` | Playwright 端到端验收 |

## HTTP 快速验证

```bash
curl http://localhost:3000/health
curl http://localhost:3000/config
curl http://localhost:3000/changes?since=0
```

创建 decision：

```bash
curl -X POST http://localhost:3000/cards \
  -H "Content-Type: application/json" \
  -H "X-Actor: agent" \
  -d '{"type":"decision","status":"waiting","fields":{"title":"是否采用方案 A？","options":["采用 A","采用 B"]}}'
```

提交正式回复：

```bash
curl -X POST http://localhost:3000/cards/<card-id>/actions/reply \
  -H "Content-Type: application/json" \
  -H "X-Actor: human" \
  -d '{"fields":{"reply":"采用方案 A","replied_by":"human"}}'
```

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

## 更多文档

- 开发、提交、测试和 PR 规则：[CONTRIBUTING.md](CONTRIBUTING.md)
- AI agent 协作约定：[AGENTS.md](AGENTS.md)
- 开发者说明：[docs/development.md](docs/development.md)
- 路线图：[docs/ROADMAP.md](docs/ROADMAP.md)
- 阶段 3 设计：[docs/stages/stage-3-agent-decision-loop/design.md](docs/stages/stage-3-agent-decision-loop/design.md)
- 阶段 3 实施计划：[docs/stages/stage-3-agent-decision-loop/plan.md](docs/stages/stage-3-agent-decision-loop/plan.md)

## 后续方向

- 人类登录与会话
- agent token 与 RBAC scope
- 状态流转执行
- 评论与协作上下文
- hook 执行器和外部集成
- 管理界面、搜索、备份说明和体验打磨
