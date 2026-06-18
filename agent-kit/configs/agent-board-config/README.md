# Agent 实战看板配置

## 内容

这套配置服务 agent 和人类之间的异步协作闭环。它沿用项目核心 id：`task`、`decision`、`memo`、`default`、`active`、`waiting`、`resolved`、`done`。

## 用途

- `decision` 用于 agent 向人类发起需要正式回复的问题。
- `waiting` 表示等待人类处理。
- `reply` action 表示人类提交正式回复。
- `reply` 与 `replied_by` 记录正式回复内容和回复人。
- `options` 可表达候选方案，但不限制人类只能选择候选项。

## 启动

```powershell
pnpm scenario:start agent-board-config --fresh
```

## 观察点

- agent 可创建 `status=waiting` 的 decision。
- 人类可在网页中看到等待回复的 decision。
- 人类提交正式回复后，回复字段可读取，changes 中有回复事件。
