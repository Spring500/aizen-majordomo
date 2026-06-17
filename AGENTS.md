# AGENTS.md

面向 AI agent 的最小协作规则。完整开发、提交、PR 和 CI 规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发位置

- 每项工作新建分支或 worktree。
- 不在 `main` 上做日常开发。
- 远端 `main` 必须通过 PR 和 CI 落地。

## 提交信息

- 格式：首行 `类型: 标题`，空行，`意图：...`，空行，`主要修改：` + 至少一条 `- ` 要点。
- 类型九选一：`功能 / 修复 / 重构 / 文档 / 测试 / 构建 / 性能 / 样式 / 杂项`。
- 禁止模型署名：不得写 `Co-Authored-By`、`Generated with ...`、机器人 emoji 等。
- `文档`、`构建`、`测试` 类提交只能包含对应性质的文件。

## 测试与门禁

- 写任何测试时，每个 `expect` 都要带中文辅助信息。
- 分支提交会跑 `pnpm test`。
- 涉及前端或用户流程时运行 `pnpm test:e2e`。
- PR 必须通过 GitHub required checks：`Commit messages` 和 `Tests`。
- 本地 hook 只是即时反馈；远端 branch protection + CI 是硬门禁。

## 落地方式

- 标准流程：分支提交 -> push -> PR -> CI 通过 -> merge。
- 本地 `main` 合并只用于特殊验证或离线场景。
- 私有分支临时 WIP 快照可用 `git commit --no-verify`；其余场景不要绕过 hook。
