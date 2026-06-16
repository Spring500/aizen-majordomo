# 阶段 2 场景化配置测试规格

本文是 `docs/stages/stage-2-basic-config-model/plan.md` 的补充规格。它把阶段 2 的验收目标从“默认样例配置可用”扩展为“配置化基建可被多配置、多数据库状态、多场景重复证明”。

## 1. 目标

阶段 2 的核心目标是搭建配置化基础设施。仅验证一套默认样例配置不足以证明系统真正配置驱动，因为代码可以写死同样的字段和状态而仍然通过测试。

因此阶段 2 必须交付一套场景化配置测试能力：

- 使用多套配置验证后端、前端和数据库行为随配置变化。
- 使用多种数据库初始状态验证空库、已有数据、旧库迁移和大量数据。
- 人工验收和 E2E 复用同一批场景资产。
- 默认启动路径也使用场景配置，避免维护独立的 TypeScript 样例配置源。

## 2. 核心原则

### 2.1 场景是项目资产，不是测试专用 mock

场景放在仓库根目录：

```text
scenarios/
```

它们服务三类用途：

- 产品默认配置种子。
- 人工观察和评审。
- 自动化测试和 E2E。

测试代码仍放在 `tests/`，但场景本身不放在 `tests/`，避免正式启动逻辑依赖测试路径。

### 2.2 默认配置也是一个场景

不再维护独立的 `src/config/sample.ts` 作为默认配置源。

默认配置来自：

```text
scenarios/default-sample/config.json
```

规则：

- 未设置 `CONFIG_SEED_PATH` 时，启动使用 `scenarios/default-sample/config.json`。
- 设置 `CONFIG_SEED_PATH` 时，启动使用指定 JSON 配置。
- 所有配置都通过同一套 loader、schema 校验和引用校验。
- 运行时配置仍以 SQLite 为事实来源，JSON 只作为初始化种子。

### 2.3 配置文件统一使用 JSON

阶段 2 的默认配置和场景配置均使用 JSON。

不使用 TypeScript 作为场景配置格式，原因：

- JSON 更适合人工审阅。
- JSON 更接近未来配置导入导出的形态。
- JSON 能避免测试场景通过代码逻辑隐藏配置内容。

### 2.4 场景 README 不是交付说明

每个场景可以包含 `README.md`，用于说明这个场景包含什么、大致可以验证什么、如何启动。

场景 README 不承担本次 feature 的交付说明职责。交付说明应写在 PR、merge commit、发布说明或最终交付回复中。

场景 README 建议结构：

```text
# <scenario-id>

## 内容

## 用途

## 启动

## 观察点

## 备注
```

### 2.5 生成数据库不提交

场景源文件提交到仓库。生成数据库不提交。

必须忽略：

```gitignore
data/scenarios/
.tmp/scenarios/
.tmp/e2e/
```

## 3. 场景目录结构

阶段 2 必须包含 6 个场景：

```text
scenarios/
  default-sample/
    scenario.json
    config.json
    seed.ts
    README.md

  custom-review-flow/
    scenario.json
    config.json
    seed.ts
    README.md

  status-matrix/
    scenario.json
    config.json
    seed.ts
    README.md

  existing-data-config-change/
    scenario.json
    config.before.json
    config.after.json
    seed.ts
    README.md

  legacy-stage1-migration/
    scenario.json
    legacy-seed.sql
    README.md

  large-dataset-smoke/
    scenario.json
    config.json
    seed.ts
    README.md
```

## 4. `scenario.json`

`scenario.json` 是场景入口文件，描述场景如何准备。

普通场景示例：

```json
{
  "id": "custom-review-flow",
  "name": "自定义 Review 工作流",
  "description": "验证前端和后端没有写死默认 task/decision/memo 配置。",
  "config": "config.json",
  "seed": {
    "type": "ts",
    "path": "seed.ts"
  },
  "readme": "README.md",
  "tags": ["stage2", "config-driven", "frontend"],
  "expected": {
    "cardTypes": ["review"],
    "statuses": ["triage", "approved", "rejected"]
  }
}
```

配置变化场景示例：

```json
{
  "id": "existing-data-config-change",
  "name": "已有数据后的配置变化",
  "description": "验证已有卡片后配置字段变化不会破坏历史数据读取。",
  "phases": [
    {
      "name": "before",
      "config": "config.before.json",
      "seed": {
        "type": "ts",
        "path": "seed.ts"
      }
    },
    {
      "name": "after",
      "config": "config.after.json"
    }
  ],
  "readme": "README.md",
  "tags": ["stage2", "config-change", "existing-data"]
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `id` | 稳定场景 ID，用于 CLI、测试 helper 和文档引用。 |
| `name` | 面向人的场景名称。 |
| `description` | 场景要证明的核心内容。 |
| `config` | 单阶段场景的配置 JSON，相对场景目录。 |
| `phases` | 多阶段场景，例如先用旧配置建数据，再切换新配置。 |
| `seed` | 数据准备脚本或 SQL。 |
| `readme` | 场景说明文档。 |
| `tags` | 场景分类，用于筛选。 |
| `expected` | 轻量自检信息，不替代测试断言。 |

## 5. 场景命令

阶段 2 新增场景 CLI：

```powershell
pnpm scenario:list
pnpm scenario:prepare <scenario-id>
pnpm scenario:start <scenario-id> [--port N] [--fresh]
pnpm scenario:copy-db <scenario-id> <target-db>
```

### 5.1 `scenario:list`

列出所有场景：

```text
default-sample              默认样例配置
custom-review-flow          自定义 Review 工作流
status-matrix               状态矩阵
existing-data-config-change 已有数据后的配置变化
legacy-stage1-migration     阶段 1 旧库迁移
large-dataset-smoke         1000 张卡大量数据冒烟
```

### 5.2 `scenario:prepare <id>`

生成场景基准数据库：

```text
data/scenarios/<id>.prepared.db
```

流程：

1. 删除旧的 prepared db、`-wal`、`-shm`。
2. 使用场景配置初始化数据库。
3. 执行 seed。
4. 对多阶段场景执行 before -> seed -> after。
5. 执行 `PRAGMA wal_checkpoint(TRUNCATE)`。
6. 输出生成路径。

### 5.3 `scenario:start <id> [--port N] [--fresh]`

启动某个场景供人工观察或调试。

流程：

1. 如果 `--fresh` 或 prepared db 不存在，先 prepare。
2. 从 prepared db 复制 runtime db：

```text
data/scenarios/<id>.runtime.db
```

显式传入 `--port N` 时，为支持同一场景多端口并行观察，runtime db 使用端口隔离路径：

```text
data/scenarios/<id>.port<N>.runtime.db
```

3. 使用 runtime db 启动服务。
4. 打印场景、地址、数据库、配置和 README 路径。

默认端口是 3000。可通过 `--port` 启动多个场景。

### 5.4 `scenario:copy-db <id> <target>`

复制一个完整、稳定的场景数据库给 E2E 或临时测试使用。

流程：

1. 如果 prepared db 不存在，先 prepare。
2. 删除目标 db、`-wal`、`-shm`。
3. 复制 prepared db 到目标路径。

## 6. 数据库策略

不采用“清空现有数据库再复用”的方案。统一采用：

```text
源场景文件 -> prepared db -> runtime db
```

原因：

- 清空容易漏表。
- 复制数据库更接近真实运行状态。
- 每次测试状态确定。
- prepared db 可以包含复杂历史状态。

SQLite 使用 WAL 时，prepare 结束必须 checkpoint：

```sql
PRAGMA wal_checkpoint(TRUNCATE);
```

复制时只复制主 `.db` 文件，并删除目标位置可能存在的 `-wal` 和 `-shm`。

## 7. 必备场景

### 7.1 `default-sample`

证明默认配置路径可用。

配置内容：

- `task`
- `decision`
- `memo`
- `risk_level`
- `default`、`active`、`waiting`、`resolved`、`done`
- 默认流转和 hook 骨架

必须验证：

- `/config` 返回默认配置。
- 前端能创建 task、decision、memo。
- decision 能写 options。
- `risk_level` 能创建、编辑、过滤。
- `active` 状态能用于建卡。
- 宽屏和窄屏路径可用。

### 7.2 `custom-review-flow`

证明系统没有写死默认配置。

配置内容：

- 仅包含 `review` 卡片类型。
- 字段：`title`、`review_code`、`severity`、`owner`。
- 状态：`triage`、`approved`、`rejected`。

必须验证：

- `/config` 不包含 `task`、`decision`、`memo`。
- 新建表单只显示 Review 类型。
- 新建表单出现审核码、严重程度、负责人。
- 不出现默认样例字段“风险等级”。
- 后端拒绝创建 `task`。
- 按 `severity` 过滤可用。

### 7.3 `status-matrix`

证明状态配置参与建卡、读取和筛选。

配置内容：

- 状态：`triage`、`doing`、`blocked`、`done`。
- 显示名：待分拣、处理中、受阻、完成。

必须验证：

- 新建表单状态下拉来自该配置。
- 能创建 `blocked` 状态卡。
- 左侧状态筛选显示中文状态名。
- 点击“受阻”只显示 blocked 卡。
- 点击“全部状态”恢复。
- 后端拒绝未知状态。

### 7.4 `existing-data-config-change`

证明已有卡片后配置变化不会破坏历史数据读取。

准备流程：

1. 用 `config.before.json` 初始化。
2. seed 数据。
3. 用 `config.after.json` 覆盖配置。

配置变化建议：

- `risk_level` 仍存在，但 label 改名。
- `legacy_note` 从 create/update action 移除。
- 新增字段 `impact`。

必须验证：

- 旧卡仍能读取。
- 历史 `legacy_note` 不丢失，API `fields` 里仍可见。
- 新建和编辑表单不再显示 `legacy_note`。
- 编辑不允许写 `legacy_note`。
- 新增 `impact` 可写。
- `risk_level` 过滤按 value 工作，不受 label 改名影响。

### 7.5 `legacy-stage1-migration`

证明阶段 1 旧库能升级到阶段 2 字段值表模型。

准备方式：

- `legacy-seed.sql` 创建阶段 1 旧 `cards` 表结构。
- 插入 task、decision、memo。

必须验证：

- 启动后生成新 `cards` 核心表。
- 业务字段进入 `card_field_values`。
- API 仍返回阶段 1 扁平字段。
- API 也返回 `fields`。
- 前端能打开迁移后的卡片。
- 编辑后写入字段值表。
- `cards_legacy_stage2` 存在但不作为读取来源。

### 7.6 `large-dataset-smoke`

证明字段值表和配置过滤在 1000 张卡下没有明显正确性问题。

初始数据：

- 1000 张卡。
- 分布不同状态、负责人和配置字段值。

必须验证：

- 列表能加载。
- 默认分页仍生效。
- `field.risk_level=high` 可用。
- `assignee` 兼容筛选可用。
- 页面不出现明显卡死或布局崩坏。

1000 是阶段 2 的正确性冒烟规模。更大规模需要性能指标、计时方式、索引策略和失败阈值，应进入后续性能基线工作。

## 8. E2E 复用要求

场景系统不规定 E2E 文件组织方式。

允许：

- 按阶段组织。
- 按场景组织。
- 按用户路径组织。
- 按风险主题组织。

阶段 2 只规定必须提供测试 helper，让 E2E 能启动指定场景：

```ts
const runtime = await prepareScenarioRuntime('custom-review-flow');
const server = await startScenarioServer(runtime);
```

测试结束必须停止服务并清理临时数据库。

现有 `scripts/e2e-server.ts` 保留，但应改造为默认启动 `default-sample` 场景，以保持 `pnpm test:e2e` 兼容。

## 9. 人工观察方式

人工观察从场景入口开始：

```powershell
pnpm scenario:list
pnpm scenario:start <scenario-id>
```

场景启动后脚本打印：

```text
场景：custom-review-flow
说明：验证前端和后端没有写死默认配置
地址：http://127.0.0.1:3000
数据库：data/scenarios/custom-review-flow.runtime.db
配置：scenarios/custom-review-flow/config.json
说明：scenarios/custom-review-flow/README.md
```

人工观察不是“客户必须照做的固定操作清单”。场景 README 只说明场景内容、用途和可观察点。交付说明应出现在 PR、merge commit、发布说明或最终交付回复中。

## 10. 完成定义

本补充规格完成时必须满足：

- `scenarios/` 下 6 个阶段 2 场景全部落地。
- 默认启动使用 `scenarios/default-sample/config.json`。
- 不再使用独立 TypeScript `SAMPLE_CONFIG` 作为配置事实来源。
- `CONFIG_SEED_PATH` 可指定任意场景配置 JSON。
- `pnpm scenario:list` 可列出所有场景。
- `pnpm scenario:prepare <id>` 可生成 prepared db。
- `pnpm scenario:start <id> [--port N] [--fresh]` 可启动场景。
- `pnpm scenario:copy-db <id> <target>` 可复制稳定数据库。
- 生成数据库路径被 `.gitignore` 忽略。
- 人工观察和 E2E 复用同一批场景资产。
- 自动化覆盖 6 个场景的关键证明点。
- README、路线图和阶段计划补充文档与实际行为一致。
- `pnpm test`、`pnpm typecheck`、`pnpm build:web`、`pnpm test:e2e` 通过。
