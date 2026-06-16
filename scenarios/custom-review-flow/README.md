# custom-review-flow

## 内容

只包含 `review` 卡片类型和 `triage`、`approved`、`rejected` 三个状态。

字段完全不同于其它阶段 2 场景：

- `case_subject`：核验主题
- `audit_domain`：审查领域
- `evidence_url`：证据链接
- `needs_followup`：需要跟进

## 用途

验证系统没有写死默认的 `task`、`decision`、`memo` 类型，也没有依赖标题、负责人、风险等级等默认字段。

## 启动

`pnpm scenario:start custom-review-flow`

## 观察点

新建表单应只出现 Review 类型，并展示核验主题、审查领域、证据链接、需要跟进字段。

## 备注

该场景包含一张隐私合规领域的 review 样例卡，可用于字段过滤观察。
