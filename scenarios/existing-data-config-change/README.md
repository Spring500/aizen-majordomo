# existing-data-config-change

## 内容

先用 before 配置创建含 `legacy_note` 的 task，再切换到 after 配置。

## 用途

验证配置变化后历史字段值不会丢失，新配置字段会生效。

## 启动

`pnpm scenario:start existing-data-config-change`

## 观察点

旧卡 API 的 `fields` 中仍有 `legacy_note`；新建和编辑表单不再展示旧备注，并出现影响面字段。

## 备注

`risk_level` 的 value 保持不变，但 label 从风险等级改为风险分级。
