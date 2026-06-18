# 阶段 3 人机决策闭环设计

## 1. 目标

阶段 3 交付一个可实际给 AI agent 使用的人机决策闭环：

1. agent 通过配套 CLI 创建一张等待人类回复的 `decision`。
2. 人类在网页中提交正式回复。
3. agent 通过配套 CLI 等到回复，并在 CLI 输出中直接获得回复内容。
4. 服务端保留可增量读取的 `changes` 事件流，供 CLI、agent 和后续 hook 使用。

阶段 3 从这里开始形成三个可交付面：

- 看板服务系统。
- 面向实战 agent 协作的看板配置。
- 配套 agent skill 和 CLI。

## 2. 已确认决策

- 阶段 3 新增通用 action 接口，`reply` 是第一个真实业务 action。
- 人类提交正式回复使用 `POST /cards/:id/actions/reply`。
- `reply` 必须基于卡片类型配置中的 `reply` action、可写字段和必填字段校验，不写死 `type === "decision"`。
- `ask` 创建的 decision 默认 `status = "waiting"`；agent 提问流程不暴露 `default` 状态。
- 阶段 3 的回复动作不自动修改状态。状态流转留给阶段 4，自动流转留给阶段 8 hook。
- `changes` 是 agent 可消费的事件流，不只是字段审计。
- agent 侧交付物集中放在 `agent-kit/` 下。
- skill 与配套 CLI 放在同一个 skill 目录。
- CLI 只提供 `ask` 和 `wait-reply` 两个命令，不提供别名，不提供组合命令。
- `wait-reply` 不提供超时。skill 必须说明人类回复间隔可能很长，agent 应允许命令长期阻塞。
- CLI 默认输出是给 AI agent 读的简短自然语言提示，不以裸 JSON 作为默认输出。
- CLI 支持短参数输入和 stdin JSON 输入；不推荐把大段 JSON 放进命令行参数。
- 阶段 3 新增独立的 `agent-board-config`，不复用 `default-sample` 的测试职责。
- `agent-board-config` 沿用核心 id：`task`、`decision`、`memo`、`default`、`active`、`waiting`、`resolved`、`done`。
- 阶段 3 不暴露 actor 覆盖参数。CLI 创建的 decision actor 固定为 `agent`；网页回复人默认使用 `human`。
- README 保持主干使用者入口结构；开发流程和 PR 规则继续由 `CONTRIBUTING.md` 承接。

## 3. Agent Kit 目录

```text
agent-kit/
  configs/
    agent-board-config/
      scenario.json
      config.json
      README.md
  skills/
    majordomo/
      SKILL.md
      scripts/
        majordomo.mjs
      references/
        api.md
        board-config.md
        recovery.md
        examples.md
```

### 3.1 配置

`agent-kit/configs/agent-board-config/` 是正式的 agent 协作配置资产。它应当能被现有场景工具加载并纳入自动化验收，但不取代 `scenarios/default-sample/`。

该配置的目标不是覆盖所有测试矩阵，而是提供一套真实 agent 使用时可理解、可持续使用的看板语义：

- `decision` 表示 agent 需要人类正式决策。
- `waiting` 表示等待人类处理。
- `reply` action 表示人类正式回复。
- `reply` 和 `replied_by` 是正式回复字段。
- `options` 用于表达可选方案，不强制人类只能选择其中之一。

### 3.2 Skill

`SKILL.md` 是 agent 读到的入口，只写必要流程：

- 什么时候使用 majordomo。
- 如何使用 `ask` 创建人类决策。
- 如何使用 `wait-reply` 等待回复。
- 等待可能很久，不要自行假设失败。
- 如果命令中断，重新运行 `wait-reply --card-id <id>`。
- 复杂输入使用 stdin JSON，短输入可用参数。

详细 API、配置语义、恢复策略和示例放在 `references/`。

### 3.3 CLI

CLI 位于：

```text
agent-kit/skills/majordomo/scripts/majordomo.mjs
```

CLI 从 skill 目录直接运行，不在项目根 `package.json` 增加应用层转发：

```text
node scripts/majordomo.mjs ask ...
node scripts/majordomo.mjs wait-reply --card-id ...
```

## 4. CLI 行为

### 4.1 连接服务

CLI 连接地址优先级：

1. `--base-url`
2. `MAJORDOMO_BASE_URL`
3. `http://127.0.0.1:3000`

### 4.2 `ask`

`ask` 创建一张 `decision` 卡：

- `type = "decision"`
- `status = "waiting"`
- `created_by = "agent"`
- 写入 `title`、`body`、`options` 和可选 `fields`

短输入示例：

```powershell
node scripts/majordomo.mjs ask --title "是否采用方案 A？" --body "请确认。" --option "采用 A" --option "采用 B"
```

复杂输入示例：

```powershell
node scripts/majordomo.mjs ask --stdin < decision.json
```

`ask` 成功默认输出：

```text
已创建等待人类回复的 decision。

本次询问的 card id 是：3f2c...

运行以下命令等待回复：
node scripts/majordomo.mjs wait-reply --card-id 3f2c...
```

### 4.3 `wait-reply`

`wait-reply` 等待一张卡已经有正式回复：

1. 先读取 `GET /cards/:id`。
2. 如果 `fields.reply` 已有非空值，直接输出回复。
3. 如果没有回复，轮询 `GET /changes?since=<lastSeq>`。
4. 看到相关卡片变化后重新读取卡片。
5. 确认 `fields.reply` 非空后输出回复。

该命令不提供超时。中断后重新执行同一条命令即可恢复。

成功输出：

```text
已收到人类回复。

card id：3f2c...
回复人：human
回复内容：
采用方案 A，因为风险更低。
```

## 5. HTTP 接口

### 5.1 Action 接口

新增：

```text
POST /cards/:id/actions/:actionId
```

阶段 3 支持：

```text
POST /cards/:id/actions/reply
```

请求体：

```json
{
  "fields": {
    "reply": "采用方案 A，因为风险更低。",
    "replied_by": "human"
  }
}
```

规则：

- 卡片必须存在。
- 卡片类型必须存在且启用。
- 卡片类型必须声明启用的 `reply` action。
- 请求字段必须在 `reply.writableFields` 中。
- `reply.requiredFields` 必须满足。
- 字段值必须通过字段类型校验。
- 成功后更新字段值和 `updated_at`。
- 成功后写入 `changes` 事件。
- 不修改 `status`。

### 5.2 Changes 接口

新增：

```text
GET /changes?since=<seq>
```

响应按 `seq` 升序返回。

非法 `since` 返回统一错误体，`details.field = "since"`。

事件形状：

```json
{
  "seq": 12,
  "event": "card.action.reply",
  "cardId": "3f2c...",
  "action": "reply",
  "actor": "human",
  "at": 1234567890,
  "payload": {
    "fields": {
      "reply": "采用方案 A，因为风险更低。",
      "replied_by": "human"
    }
  }
}
```

阶段 3 至少写入：

- `card.created`
- `card.updated`
- `card.action.reply`

## 6. 前端

阶段 3 前端只做最小可用闭环：

- 卡片详情中对声明了 `reply` action 的卡显示正式回复区。
- 已有 `reply` 时展示回复内容和回复人。
- 未回复时显示回复输入框和提交按钮。
- 提交回复调用 `POST /cards/:id/actions/reply`。
- 提交成功后刷新详情和列表。
- 列表对等待回复的 decision 做明显标记。
- 筛选区提供“等待回复”入口，筛出 `type=decision` 且 `status=waiting` 的卡。
- 宽屏和窄屏都能找到等待回复卡、打开详情并提交回复。

## 7. 文档入口

阶段 3 只补充必要入口，不重排主干 README：

- `README.md`：面向使用者，在主干结构上补充 agent-kit 使用入口和阶段 3 链接。
- `CONTRIBUTING.md`：继续作为开发、提交、测试和 PR 规则入口。
- `agent-kit/configs/agent-board-config/README.md`：面向人类说明 agent board 配置。
- `agent-kit/skills/majordomo/SKILL.md`：面向 AI agent 的操作入口。

## 8. 范围外

- 不做登录、token、scope 或 actor 权限。
- 不做 SSE、WebSocket 或服务端长连接订阅。
- 不做 hook 执行。
- 不做状态流转执行。
- 不做评论。
- 不做安装器、插件市场适配或发布脚本。
- 不把 `agent-board-config` 设为默认启动配置。

## 9. 完成定义

- `agent-board-config` 作为独立 agent 配置资产落地，并能被场景工具加载。
- `POST /cards/:id/actions/reply` 可按配置 action 校验并保存正式回复。
- 创建、编辑、回复均写入 `changes` 事件。
- `GET /changes?since=` 支持增量读取。
- CLI `ask` 可创建 `status=waiting` 的 decision，并输出 card id 和等待命令。
- CLI `wait-reply` 可等待并输出人类回复；重复运行不会错过已提交回复。
- skill 和 references 能指导 agent 使用 CLI、处理长等待和中断恢复。
- 前端能显示等待回复卡并提交正式回复。
- README 与开发者文档分层完成。
- 自动化测试覆盖路线图 S3-T1 到 S3-T11。
- 宽屏和窄屏验收覆盖等待回复视图与回复提交。
- `pnpm test`、`pnpm typecheck`、`pnpm test:e2e` 通过。
