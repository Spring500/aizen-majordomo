# AGENTS.md

面向 AI agent 的最小协作规则。通用提交、PR 和 CI 规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发位置

- 实现任务必须使用 worktree。
- 只读检查或极小文档修改可只用独立分支。
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
- PR 必须通过 GitHub required checks。
- 本地 hook 只是即时反馈；远端 branch protection + CI 是硬门禁。

## 开发流程

1. 从最新 `main` 创建 worktree 和任务分支。
2. 在 worktree 中实现、测试和提交，不在 `main` 上做日常开发。
3. 推送任务分支并创建或更新 PR。
4. 创建或更新 PR 后，必须等待 GitHub required checks 完成。
5. checks 失败时，agent 必须读取失败日志、定位原因、修复问题、推送更新，并再次等待 checks。
6. checks 通过后，agent 只向人类报告 PR 链接、验证结果和“可以人工审核”；不要自行合并 PR。

只有缺少权限、外部服务不可用，或同一阻塞条件连续复现且无法靠代码修复时，才向人类报告阻塞原因和已查证的信息。

私有分支临时 WIP 快照可用 `git commit --no-verify`；其余场景不要绕过 hook。
