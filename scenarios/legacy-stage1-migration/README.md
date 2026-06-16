# legacy-stage1-migration

## 内容

使用 `legacy-seed.sql` 创建阶段 1 旧 `cards` 表并插入 task、decision、memo。

## 用途

验证启动迁移会生成新的 `cards` 核心表和 `card_field_values` 字段值表。

## 启动

`pnpm scenario:start legacy-stage1-migration`

## 观察点

API 应同时返回阶段 1 扁平字段和阶段 2 `fields`；数据库中应保留 `cards_legacy_stage2`。

## 备注

该场景默认使用 `default-sample` 配置完成迁移后的运行时配置初始化。
