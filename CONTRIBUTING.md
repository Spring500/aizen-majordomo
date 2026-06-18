# CONTRIBUTING

本文件说明本项目的提交、测试、PR 和 CI 规则。AI agent 的额外硬约束见 [AGENTS.md](AGENTS.md)。

## 开发位置

- 推荐每项工作使用独立分支，分支名可使用 `codex/<任务名>`。
- 需要并行任务或隔离较大改动时，可使用 worktree。
- 远端 `main` 只接收通过 PR 和 CI 的落地。

## 远端落地流程

GitHub 远端 `main` 已启用 branch protection：

- 必须通过 PR 合入。
- 必须通过 GitHub required checks。
- 禁止 force push 和删除 `main`。
- 管理员也受保护规则约束。

## 本地门禁

本地 Husky hook 只作为即时反馈；真正不可绕过的门禁在 GitHub PR + CI。

| 触发点 | 检查 |
| --- | --- |
| `commit-msg` | 校验单条提交信息格式 |
| 分支 `pre-commit` | 运行 `pnpm test` |
| `main` 上提交 | 运行 `pnpm test` 和 `pnpm test:e2e` |
| `main` 上 `--no-ff` 合并 | 校验合入范围每条提交信息，并运行全量测试 |

本地 hook 可被 `--no-verify` 绕过；除私有分支临时 WIP 快照外，不要绕过。

## 提交信息

所有提交信息必须使用以下格式：

```text
类型: 标题

意图：说明为什么做这次提交。

主要修改：
- 说明主要改动
```

类型九选一：

| 类型 | 用途 |
| --- | --- |
| `功能` | 新增功能、端点或能力 |
| `修复` | 修复 bug 或错误行为 |
| `重构` | 不改变外部行为的代码结构调整 |
| `文档` | 仅改动文档 |
| `测试` | 新增或调整测试 |
| `构建` | 构建、依赖、工具链、脚本、CI |
| `性能` | 性能优化 |
| `样式` | 格式或风格调整 |
| `杂项` | 其他无法归类的改动 |

规则：

- 首行必须是 `类型: 标题`，冒号后有一个空格。
- 标题用中文，控制在 50 个字符以内，末尾不加句号。
- 首行后空一行，再写正文。
- 正文必须包含 `意图：` 和 `主要修改：`。
- `主要修改：` 下至少一条 `- ` 要点。
- 禁止模型署名，包括 `Co-Authored-By`、`Generated with ...`、机器人 emoji 等。
- `Merge ...`、`Revert ...`、`fixup!`、`squash!` 等 Git 自动生成标题由 hook 放行。

示例：

```text
功能: 增加令牌鉴权中间件

意图：让 agent 通过 Bearer 令牌访问 API，并按角色 scope 限权。

主要修改：
- 新增鉴权中间件
- 在卡片路由挂载鉴权
```

## 原子提交

`文档`、`构建`、`测试` 三类提交必须只包含对应性质的文件：

| 类型 | 允许文件示例 |
| --- | --- |
| `文档` | `*.md`、`docs/`、`README`、`CHANGELOG` |
| `构建` | `package.json`、lockfile、`.husky/`、`scripts/`、`.github/`、配置文件 |
| `测试` | `tests/`、`*.test.*`、`*.spec.*` |

其他类型不做路径级限制，但仍应保持一个提交只表达一件逻辑事。

## 测试

常用命令：

```bash
pnpm test
pnpm test:e2e
pnpm typecheck
```

要求：

- 写任何测试时，每个 `expect` 都要带中文辅助信息，说明失败意味着什么、应该查什么。
- 浏览器 E2E 使用相对路径，例如 `page.goto('/')`；不要在用例里写固定端口。
- 需要启动场景服务时使用 `tests/helpers/scenario.ts`，不要手写监听端口或共享 DB 路径。
- 测试运行产物必须使用测试运行目录，不写入正式 `data/`。
- 分支提交前至少保持 `pnpm test` 通过。
- 涉及前端或用户流程时运行 `pnpm test:e2e`。
- 未实现的行为规格先用 `it.todo` 或 `it.skip` 占位；实现时再换成真实断言。

## 本地离线合并

日常落地应走 GitHub PR。本地 `main` 合并只用于特殊验证或离线场景。

支持两种本地方式：

- `git merge --squash <分支>` 后 `git commit`：丢弃分支历史，只保留最终提交。
- `git merge --no-ff <分支>`：保留分支历史，并校验合入范围每条提交信息。

仓库已设置 `merge.ff = false`，避免快进合并绕过本地 `pre-merge-commit`。

## 本地资料

以下内容不应进入版本控制：

- `data/` 和 `*.db*`
- `docs/local/`
- `代理执行笔记/`
- `.worktrees/`
- Playwright 和测试运行产物
