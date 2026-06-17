# 阶段 2 场景化配置测试补充实施计划

本文是 `scenario-config-testing-spec.md` 的执行计划，作为 `plan.md` 的补充。除非规格文档审阅通过，不应开始实现。

## 1. 范围

本计划只实现阶段 2 场景化配置测试能力：

- 多场景配置资产。
- JSON 配置种子加载。
- 场景数据库 prepare、start、copy-db。
- 人工观察入口。
- E2E 复用入口。
- 6 个阶段 2 必备场景。

不实现：

- 配置管理 UI。
- 通用数据导入系统。
- 性能基准报告。
- 场景服务管理 UI。
- 配置版本、回滚和发布流程。

## 2. 任务拆分

### Task 1: 文档和范围更新

Files:

- Modify: `docs/ROADMAP.md`
- Modify: `docs/stages/stage-2-basic-config-model/plan.md`
- Create: `docs/stages/stage-2-basic-config-model/scenario-config-testing-spec.md`
- Create: `docs/stages/stage-2-basic-config-model/scenario-config-testing-plan.md`

Steps:

- [ ] 在路线图阶段 2 中加入场景化配置测试能力。
- [ ] 在阶段 2 原计划中补充完成定义、测试要求和人工观察入口。
- [ ] 保持“后续阶段事项写路线图，本阶段事项写阶段 2 补充文档”的边界。

### Task 2: 默认配置改为场景 JSON

Files:

- Create: `scenarios/default-sample/config.json`
- Create: `scenarios/default-sample/scenario.json`
- Create: `scenarios/default-sample/README.md`
- Create: `src/config/load-seed.ts`
- Modify: `src/config/initialize.ts`
- Modify/Delete: `src/config/sample.ts`
- Modify: `tests/http/config.test.ts`

Steps:

- [ ] 把当前 `SAMPLE_CONFIG` 内容迁移为 `scenarios/default-sample/config.json`。
- [ ] 实现 `loadSeedConfig()`。
- [ ] 未设置 `CONFIG_SEED_PATH` 时读取 default-sample。
- [ ] 设置 `CONFIG_SEED_PATH` 时读取指定 JSON。
- [ ] 所有配置走现有结构校验和引用校验。
- [ ] 更新测试，不再依赖 TS `SAMPLE_CONFIG`。

### Task 3: 场景 CLI 和数据库复制

Files:

- Create: `scripts/scenario.ts`
- Create: `scripts/scenario-lib.ts`
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `tests/http/scenario-tool.test.ts`

Steps:

- [ ] 实现 `scenario:list`。
- [ ] 实现 `scenario:prepare <id>`。
- [ ] 实现 `scenario:start <id> [--port N] [--fresh]`。
- [ ] 实现 `scenario:copy-db <id> <target>`。
- [ ] prepare 结束执行 `PRAGMA wal_checkpoint(TRUNCATE)`。
- [ ] copy-db 删除目标 `.db`、`-wal`、`-shm` 后复制。
- [ ] `.gitignore` 忽略 `data/scenarios/`、`.tmp/scenarios/`、`.tmp/e2e/`。
- [ ] 测试覆盖 prepare 和 copy-db。

### Task 4: 6 个场景资产

Files:

- Create: `scenarios/default-sample/seed.ts`
- Create: `scenarios/custom-review-flow/*`
- Create: `scenarios/status-matrix/*`
- Create: `scenarios/existing-data-config-change/*`
- Create: `scenarios/legacy-stage1-migration/*`
- Create: `scenarios/large-dataset-smoke/*`

Steps:

- [ ] `default-sample` 使用默认配置。
- [ ] `custom-review-flow` 只包含 `review` 类型。
- [ ] `status-matrix` 使用 `triage/doing/blocked/done` 状态。
- [ ] `existing-data-config-change` 支持 before -> seed -> after。
- [ ] `legacy-stage1-migration` 使用 SQL 构造阶段 1 旧库。
- [ ] `large-dataset-smoke` 生成 1000 张卡。
- [ ] 每个场景包含 README，说明内容、用途、启动和观察点。

### Task 5: E2E 场景 helper

Files:

- Create: `tests/helpers/scenario.ts`
- Modify: `scripts/e2e-server.ts`
- Modify/Create: `tests/e2e/*`

Steps:

- [ ] 提供 `prepareScenarioRuntime(id)`。
- [ ] 提供 `startScenarioServer(runtime)`。
- [ ] 自动分配端口或允许指定端口。
- [ ] 测试结束停止服务并清理临时数据库。
- [ ] `scripts/e2e-server.ts` 默认启动 `default-sample` 场景。

### Task 6: 自动化覆盖

Files:

- Modify/Create: `tests/http/*.test.ts`
- Modify/Create: `tests/web/*.test.tsx`
- Modify/Create: `tests/e2e/*.spec.ts`

Required coverage:

- [ ] 默认配置通过 JSON 场景加载。
- [ ] 自定义配置证明表单不是写死默认字段。
- [ ] 后端拒绝不在当前配置中的 card type。
- [ ] 状态矩阵场景证明状态下拉和状态筛选。
- [ ] 已有数据配置变化场景证明历史字段可读但不可继续写。
- [ ] 旧库迁移场景证明阶段 1 数据迁移到字段值表。
- [ ] 1000 张卡场景证明分页和字段过滤基本可用。

### Task 7: README 更新

Files:

- Modify: `README.md`

Steps:

- [ ] 说明默认配置来自 `scenarios/default-sample/config.json`。
- [ ] 说明场景命令入口。
- [ ] 说明普通启动和场景启动区别。
- [ ] 说明生成数据库不提交。

## 3. 提交拆分建议

1. `文档: 补充阶段二场景化配置规格`
   - 规格、计划、路线图和阶段计划补充。

2. `功能: 使用场景 JSON 加载默认配置`
   - default-sample 配置、loader、initialize 改造。

3. `功能: 增加场景运行工具`
   - scenario CLI、数据库 prepare/copy/start、ignore 规则。

4. `测试: 增加阶段二配置场景资产`
   - 6 个场景、seed、README。

5. `测试: 复用场景扩展阶段二验收`
   - HTTP、组件、E2E 场景覆盖。

6. `文档: 更新场景化验收说明`
   - README 和必要说明修正。

## 4. 验证命令

必须运行：

```powershell
pnpm test
pnpm typecheck
pnpm build:web
pnpm test:e2e
pnpm scenario:list
pnpm scenario:prepare default-sample
pnpm scenario:copy-db custom-review-flow .tmp/scenarios/custom-review-flow.verify.db
```

人工抽查建议：

```powershell
pnpm scenario:start custom-review-flow --fresh
pnpm scenario:start status-matrix --fresh --port 3101
```

## 5. 风险和约束

- 场景配置 JSON 必须与 TypeScript 类型保持一致，loader 必须 fail fast。
- 场景 seed 可直接写数据库，但必须限制在场景工具中使用。
- prepared db 是生成物，不能进入版本控制。
- E2E 文件组织不在本计划中强制规定。
- 大数据场景只做正确性冒烟，不做性能指标判断。
