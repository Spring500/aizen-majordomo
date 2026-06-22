# 阶段 4 可控的状态流转设计

## 1. 目标

阶段 4 的目标是把卡片状态从“可保存的字段值”升级为“只能通过已配置、可验证的 workflow transition 改变”。

本阶段交付后：

1. `status` 只能通过 `POST /cards/:id/transition` 改变。
2. 每次状态变化都必须匹配当前配置中的 transition。
3. transition 可以在同一次请求中写入配置允许的字段，例如 `reply`。
4. transition 可以附带一条可选说明，并保存为评论。
5. 状态变化会写入 `changes`，agent 能通过 `/changes?since=` 增量读取。
6. 前端不提供直接编辑 status 的入口，而是展示当前可执行的流转按钮。

阶段 4 建立的是后续权限、管理和 hook 的共同工作流基础，不做完整管理界面和角色级权限。

## 2. 已确认决策

- `transition` 是独立工作流概念，不作为普通 `action` 的子类型实现。
- 现有 `action` 服务继续保留，用于阶段 3 的字段动作兼容；但新状态变化不通过 action 完成。
- 前端“提交回复”在阶段 4 应改为执行 `submit_reply` transition。提交成功后，decision 从 `waiting` 进入 `resolved`。
- `PATCH /cards/:id`、`POST /cards/:id/actions/:actionId` 仍然禁止写入 `status`。
- transition 配置已在阶段 2 落地，本阶段不新增概念模型，只实现执行语义。
- `transition.cardType = null` 表示全局流转，适用于所有卡片类型。
- `transition.fromStatus = null` 表示全局来源状态，可从任意当前状态执行。
- transition 随请求写入的字段只受该 transition 的 `writableFields` 和 `requiredFields` 控制，不复用普通 `update` 或 `reply` action 的可写字段。
- transition 附带评论只做最小持久化和响应，不提前实现完整评论读取、评论列表 UI 或评论权限。
- 本阶段涉及到的公开类型、接口、公开函数和公开字段必须写中文 JSDoc 注释，注释解释业务契约和空值语义，不复述实现流水账。

## 3. 领域边界

### 3.1 Action

action 描述“某个卡片类型允许执行的字段动作”。阶段 3 的 `reply` action 是典型例子：

- 来源于 card type 的 `actions`。
- 校验字段是否允许写入。
- 成功后更新字段并写入 `changes`。
- 不检查当前状态。
- 不修改 `cards.status`。

action 适合保留为低层兼容能力和未来非状态动作，不承担 workflow 推进。

### 3.2 Transition

transition 描述“某类卡片从来源状态进入目标状态的合法路径”。它的业务契约是：

- 来源于全局 `transitions` 配置。
- 必须校验卡片类型是否适用。
- 必须校验当前状态是否满足 `fromStatus`。
- 成功时必须写入 `toStatus`。
- 可以在同一事务中写入允许字段。
- 可以附带可选评论。
- 必须写入 `changes`。

transition 是阶段 4 之后状态变化的唯一业务入口。阶段 8 hook 自动流转也应复用同一执行函数。

## 4. HTTP 设计

新增：

```text
POST /cards/:id/transition
```

请求体：

```json
{
  "transitionId": "submit_reply",
  "fields": {
    "reply": "采用方案 A"
  },
  "comment": "已确认，按 A 推进"
}
```

响应体：

```json
{
  "card": {
    "id": "card-id",
    "type": "decision",
    "status": "resolved",
    "fields": {
      "reply": "采用方案 A"
    }
  },
  "change": {
    "seq": 12,
    "event": "card.transition.submit_reply",
    "cardId": "card-id",
    "action": "submit_reply",
    "payload": {
      "transitionId": "submit_reply",
      "fromStatus": "waiting",
      "toStatus": "resolved",
      "fields": {
        "reply": "采用方案 A"
      },
      "commentId": "comment-id"
    }
  },
  "comment": {
    "id": "comment-id",
    "cardId": "card-id",
    "author": "human",
    "content": "已确认，按 A 推进",
    "createdAt": 1234567890
  }
}
```

规则：

- 卡片不存在返回 404。
- transition 不存在或未启用返回 404。
- transition 限定了 `cardType` 且与卡片类型不匹配时返回 404。
- `fromStatus` 与卡片当前状态不匹配时返回 409。
- `fromStatus = null` 时可从任意状态执行。
- `toStatus` 必须是启用状态；配置初始化已有校验，执行时仍做防御性校验。
- 请求字段必须都在该 transition 的 `writableFields` 中。
- `requiredFields` 必须满足。
- 字段值必须符合当前卡片类型中的字段定义。
- 请求携带未允许字段时返回 400，且不写入卡片、不写评论、不写 changes。
- `comment` 缺失或纯空白时不写评论。
- 成功时在同一事务中更新字段、更新状态、写评论、写 changes。

## 5. 后端模块设计

### 5.1 `src/cards/transitions.ts`

新增 transition 业务模块，提供一个公开执行函数：

```ts
export function runCardTransition(
  db: DatabaseSync,
  config: AppConfig,
  input: RunCardTransitionInput,
): RunCardTransitionResult
```

该函数负责：

- 查找卡片。
- 查找启用且适用的 transition。
- 校验当前状态。
- 校验可写字段和必填字段。
- 原子执行状态更新、字段写入、可选评论写入和 changes 写入。
- 返回统一结果，供 HTTP route、未来 hook 和测试复用。

### 5.2 `src/comments/repository.ts`

新增最小评论写入模块，只提供阶段 4 需要的 `createComment()`。完整评论读取和评论列表 UI 留到阶段 6。

### 5.3 `src/cards/repository.ts`

补充状态更新能力，例如 `updateCardStateAndFields()`。它应复用现有字段写入逻辑，并在同一次数据库事务中更新 `cards.status` 和 `updated_at`。

### 5.4 `src/routes/cards.ts`

新增 `POST /cards/:id/transition` 路由：

- 解析 JSON body。
- 调用 `runCardTransition()`。
- 按结果映射 400、404、409 或 200。
- 响应返回最新 card、change 和可选 comment。

## 6. 前端交互设计

### 6.1 状态展示

卡片详情继续展示当前状态，但 status 输入保持只读。列表中对每张卡展示配置化状态标签，避免只有 decision 的“等待回复”才有可见状态。

### 6.2 可用流转

前端根据当前卡片和配置筛选可用 transitions：

- `enabled !== false`
- `cardType == null || cardType === card.type`
- `fromStatus == null || fromStatus === card.status`

筛选结果在详情抽屉中显示为操作按钮。按钮文案使用 `transition.name`。

### 6.3 带字段流转

如果 transition 有 `writableFields`，按钮区域显示这些字段对应的输入控件。`requiredFields` 作为必填提示和提交前校验的 UI 依据；最终仍以后端校验为准。

`submit_reply` 使用该机制渲染正式回复输入，并提交：

```json
{
  "transitionId": "submit_reply",
  "fields": {
    "reply": "..."
  }
}
```

### 6.4 保存与流转分离

普通“保存”只调用 `PATCH /cards/:id`，只保存配置允许的普通编辑字段。

状态变化必须通过明确的 transition 按钮触发。前端不通过“用户修改 status 再保存”的方式隐式判断 action 或 transition，因为那会隐藏业务意图，也难以向用户解释 409 冲突。

## 7. 自动化测试设计

HTTP 集成测试覆盖：

- statuses 和 transitions 重复初始化不产生重复数据。
- `PATCH /cards/:id` 不能修改 `status`。
- 合法 transition 返回 200 并修改卡片状态。
- transition 不存在返回 404。
- 当前状态不满足 `fromStatus` 返回 409。
- 全局 transition 可从任意状态执行。
- transition 可写入允许字段，例如 `reply`。
- transition 可附带评论并保存。
- transition 写入 changes，agent 可通过 `/changes?since=` 读到。
- transition 请求携带未允许字段返回 400，且不写入卡片。

前端测试覆盖：

- 详情抽屉展示当前状态和可用流转按钮。
- 宽屏下 task 可执行 `start` 或 `complete`。
- 宽屏下 waiting decision 可通过 `submit_reply` 填写回复并进入 `resolved`。
- 窄屏下同样能打开详情、执行合法流转并看到状态更新。
- 非法流转的冲突错误由 HTTP 测试覆盖；前端只需要能显示后端返回的错误消息。

## 8. 人工验收指南

1. 启动服务并打开前端。
2. 创建一张 task，确认状态为默认状态。
3. 打开 task 详情，点击“开始处理”，确认状态变为“处理中”。
4. 对 task 执行“完成”，确认状态变为“完成”。
5. 创建一张 decision，或使用 agent CLI 创建 waiting decision。
6. 打开 waiting decision，填写正式回复并执行“提交回复”。
7. 确认 decision 状态变为“已解决”，回复内容仍可见。
8. 使用 HTTP 请求尝试执行当前状态不允许的 transition，确认返回 409。
9. 请求 `/changes?since=0`，确认能看到 transition 事件。
10. 收窄浏览器，在窄屏下重复打开详情和执行合法流转。

## 9. 范围外

- 不做状态、transition、角色或 token 的管理界面。
- 不做角色级 allowed transitions 权限。
- 不做 hook 执行。
- 不做完整评论读取、评论列表和评论区 UI。
- 不做配置版本、迁移、草稿发布或回滚。
- 不删除阶段 3 的 `reply` action 兼容入口。

## 10. 完成定义

- `POST /cards/:id/transition` 可按配置执行合法状态流转。
- `status` 无法通过 PATCH 或 action 修改。
- transition 校验覆盖卡片类型、来源状态、目标状态、可写字段和必填字段。
- transition 成功后写入状态、字段、可选评论和 changes。
- 前端显示状态，并通过明确按钮执行合法 transition。
- decision 正式回复通过 `submit_reply` transition 完成，并从 `waiting` 进入 `resolved`。
- 本阶段涉及的公开类型、接口、公开函数和公开字段都有中文 JSDoc 注释。
- 自动化测试覆盖路线图 S4-T1 到 S4-T11。
- 宽屏和窄屏验收路径可用。
- `pnpm test`、`pnpm typecheck`、`pnpm build:web`、`pnpm test:e2e` 通过。
