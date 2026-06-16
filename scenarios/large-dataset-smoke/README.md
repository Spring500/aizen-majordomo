# large-dataset-smoke

## 内容

包含 1000 张 task，分布在不同状态、负责人和风险等级上。

## 用途

验证列表、分页和字段过滤在阶段 2 冒烟规模下仍保持正确。

## 启动

`pnpm scenario:start large-dataset-smoke`

## 观察点

列表应加载默认分页；`field.risk_level=high` 和 `assignee=user-1` 过滤应可用。

## 备注

1000 是正确性冒烟规模，不代表性能基线。
