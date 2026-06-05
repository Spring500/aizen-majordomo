# aizen-majordomo

自托管的本地看板系统，同时服务人类与任意 AI agent：人类用作个人备忘与对 agent 的指挥/审批界面，agent 用作任务协作与向人类发起异步确认（决策卡）。

> 当前为脚手架阶段（v0.1）：已具备最小可跑的 Hono 服务、完整 SQLite 建表（规格 §5.2）、`/health` 与只读 `/cards`。鉴权、流转、changes、hook、前端尚未实现。

## 技术栈

| 项 | 选型 |
|---|---|
| 运行时 | Node.js ≥ 22.5（TypeScript，ESM） |
| 存储 | SQLite（`node:sqlite` 内置驱动，WAL） |
| 后端框架 | Hono + `@hono/node-server` |
| 校验 | zod |
| 密码哈希 | `@node-rs/argon2`（预留给后续登录功能） |
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

## 验证

```bash
# 健康检查
curl http://localhost:3000/health
# {"status":"ok","name":"aizen-majordomo","time":<epoch_ms>}

# 列卡（当前为空）
curl http://localhost:3000/cards
# {"cards":[],"total":0}
```

类型检查：

```bash
pnpm typecheck
```

## 目录结构

```
aizen-majordomo/
├─ src/
│  ├─ index.ts            # Hono 入口，挂载路由
│  ├─ db/
│  │  ├─ index.ts         # SQLite 连接（WAL/外键/busy_timeout）+ migrate()
│  │  └─ schema.sql       # 规格 §5.2 全部表与索引（幂等建表）
│  └─ routes/
│     └─ cards.ts         # 示例只读端点 GET /cards
├─ data/                  # 运行时生成的 SQLite 文件（已 gitignore）
├─ docs/                  # 设计文档（暂不入库）
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.json
```

## 脚本

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 开发模式启动（`--watch` 热重启） |
| `pnpm start` | 启动服务 |
| `pnpm typecheck` | TypeScript 类型检查（不产出文件） |

## 数据库

启动时自动执行 `src/db/schema.sql`（全部 `CREATE TABLE IF NOT EXISTS`，可重复运行）。包含表：`cards`、`comments`、`changes`、`hooks`、`statuses`、`transitions`、`roles`、`tokens`、`sessions`、`settings`。已开启 WAL 以满足并发读写的原子性要求。

## 路线图（未实现）

- 人类登录与会话（`/login`、`/logout`，argon2 + Cookie）
- 令牌鉴权中间件（`Authorization: Bearer`）与 RBAC scope 校验
- 卡片写入 / 过滤分页（`POST /cards`、`PATCH /cards/{id}`）
- 状态流转校验链（`POST /cards/{id}/transition`、`/reply`）
- 评论（`/comments`）与增量变更（`/changes?since=`）
- 出站 hook 运行器
- React 前端（看板 / 备忘 / 回复 / 管理）

详见 `docs/` 下的规格说明。
