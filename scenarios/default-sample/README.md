# default-sample

## 内容

默认样例配置，包含 `task`、`decision`、`memo` 三种卡片类型，默认状态、样例流转和 hook 动作模型。

## 用途

用于验证产品默认配置路径、阶段 1 兼容能力、阶段 2 配置字段和状态能力。

## 启动

```powershell
pnpm scenario:start default-sample
```

## 观察点

- 新建表单可选择 Task、Decision、Memo。
- Task 和 Decision 可填写风险等级。
- Decision 可填写选项。
- 状态可选择默认、处理中、等待回复、已解决、完成。

## 备注

该场景也是未设置 `CONFIG_SEED_PATH` 时的默认配置来源。
