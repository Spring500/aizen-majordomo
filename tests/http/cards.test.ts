import { describe, expect, it } from 'vitest';
import { createTestApp, insertCard, readJson } from './helpers.ts';

describe('GET /cards 列卡', () => {
  it('给定空看板，当请求列卡时，返回空数组且 total 为 0', async () => {
    const { app } = createTestApp();

    const res = await app.request('/cards');

    expect(
      res.status,
      'GET /cards 应返回 200。若失败：检查 cards 路由是否挂载，以及 db 是否经 context 注入(c.get("db"))',
    ).toBe(200);
    expect(
      await res.json(),
      '空看板应返回空 cards、total=0 和空类型计数。若失败：检查空库查询路径或 serialize() 是否对空结果出错',
    ).toEqual({ cards: [], total: 0, countsByType: {} });
  });

  it('给定库中已有一张决策卡，当请求列卡时，返回该卡且 options 被解析为数组', async () => {
    const { app, db } = createTestApp();
    insertCard(db);

    const res = await app.request('/cards');

    const body = await readJson(res);
    expect(
      body.total,
      '应恰好返回 1 张卡。若 total≠1：检查 insertCard 是否插入成功，或查询 LIMIT/过滤是否漏读多读',
    ).toBe(1);
    expect(
      body.cards[0].id,
      '返回卡片的 id 应为 card_1。若失败：检查 SELECT * 的字段映射是否与表结构一致',
    ).toBe('card_1');
    expect(
      body.cards[0].fields.options,
      'options 应由 JSON 字符串解析回数组 ["SSE","WebSocket"]。若仍是字符串：检查 serialize() 里的 JSON.parse 是否生效',
    ).toEqual(['SSE', 'WebSocket']);
  });
});

describe('阶段 1 卡片 API', () => {
  it('POST /cards 创建 task 成功返回 201、完整卡片和默认 status', async () => {
    const { app } = createTestApp();

    const res = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '补齐卡片 API', body: '阶段 1 后端能力' } }),
    });

    const body = await readJson(res);
    expect(
      res.status,
      '创建合法 task 应返回 201。若失败：检查 POST /cards 路由是否注册，以及 zod 校验是否接受 task',
    ).toBe(201);
    expect(
      body.card.status,
      '未显式传 status 时应默认为 default。若失败：检查 create card 的默认值填充逻辑',
    ).toBe('default');
    expect(
      body.card.fields.title,
      '返回标题应为请求标题。若失败：检查 title trim 与 INSERT/serialize 字段映射',
    ).toBe('补齐卡片 API');
    expect(
      Object.keys(body.card).sort(),
      '创建响应应包含完整卡片字段。若失败：检查 serializeCard 是否漏掉 schema 中的字段',
    ).toEqual(
      [
        'created_at',
        'created_by',
        'fields',
        'id',
        'status',
        'type',
        'updated_at',
      ].sort(),
    );
  });

  it('POST /cards 指定 allowAsInitial=false 的状态时返回 400', async () => {
    const { app } = createTestApp();

    const res = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', status: 'resolved', fields: { title: '不应允许' } }),
    });

    expect(
      res.status,
      'resolved 状态配置了 allowAsInitial=false，建卡应返回 400。若失败：检查路由层是否校验 allowAsInitial',
    ).toBe(400);
  });

  it('POST /cards 创建 decision 时保存 options，读取时 options 为数组', async () => {
    const { app } = createTestApp();

    const res = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'decision',
        fields: { title: '阶段 1 前端详情用什么形态', options: ['右侧抽屉', '单独详情页'] },
      }),
    });

    const body = await readJson(res);
    expect(
      res.status,
      '创建 decision 应返回 201。若失败：检查 type=decision 是否被 create schema 接受',
    ).toBe(201);
    expect(
      body.card.type,
      '创建 decision 后响应 type 应保持 decision。若失败：检查 INSERT 参数绑定',
    ).toBe('decision');
    expect(
      body.card.fields.options,
      'decision 的 options 应在响应中解析为数组。若失败：检查 options 持久化和 serializeCard',
    ).toEqual(['右侧抽屉', '单独详情页']);

    const readRes = await app.request(`/cards/${body.card.id}`);
    const readBody = await readJson(readRes);
    expect(
      readBody.card.fields.options,
      'GET /cards/:id 读取 decision 时 options 仍应是数组。若失败：检查单卡读取是否复用统一序列化',
    ).toEqual(['右侧抽屉', '单独详情页']);
  });

  it('POST /cards 创建 memo 传未配置字段 options 返回 400', async () => {
    const { app } = createTestApp();

    const res = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'memo', fields: { title: '记录一个观察', options: ['不应保存'] } }),
    });

    const body = await readJson(res);
    expect(res.status, 'memo 未配置 options 字段，传 options 应返回 400 而非静默忽略').toBe(400);
    expect(body.error.details.field, '错误详情应指出 options 字段').toBe('options');
  });

  it('POST /cards 缺少 type、非法 type、缺少 title、纯空白 title 均返回 400 并指出字段', async () => {
    const { app } = createTestApp();
    const cases = [
      { name: '缺少 type', input: { fields: { title: '无类型' } }, field: 'type' },
      { name: '非法 type', input: { type: 'bug', fields: { title: '非法类型' } }, field: 'type' },
      { name: '缺少 title', input: { type: 'task' }, field: 'title' },
      { name: '纯空白 title', input: { type: 'task', fields: { title: '   ' } }, field: 'title' },
    ];

    for (const item of cases) {
      const res = await app.request('/cards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(item.input),
      });
      const body = await readJson(res);
      expect(
        res.status,
        `${item.name} 应返回 400。若失败：检查 create schema 对必填字段和枚举的校验`,
      ).toBe(400);
      expect(
        body.error.code,
        `${item.name} 应返回 VALIDATION_ERROR。若失败：检查 badRequest 错误码映射`,
      ).toBe('VALIDATION_ERROR');
      expect(
        body.error.details.field,
        `${item.name} 应指出字段 ${item.field}。若失败：检查 zodFieldError 的 path 提取`,
      ).toBe(item.field);
    }
  });

  it('POST /cards 使用 X-Actor 写 created_by，未传时为 human', async () => {
    const { app } = createTestApp();

    const withActorRes = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'codex' },
      body: JSON.stringify({ type: 'task', fields: { title: '带 actor 创建' } }),
    });
    const withActorBody = await readJson(withActorRes);
    expect(
      withActorBody.card.created_by,
      '带 X-Actor 创建时 created_by 应使用 header 值。若失败：检查 c.req.header("X-Actor") 读取',
    ).toBe('codex');

    const defaultActorRes = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '默认 actor 创建' } }),
    });
    const defaultActorBody = await readJson(defaultActorRes);
    expect(
      defaultActorBody.card.created_by,
      '未传 X-Actor 时 created_by 应为 human。若失败：检查 DEFAULT_ACTOR 默认值',
    ).toBe('human');
  });

  it('GET /cards 支持 type、status、field.lane、field.assignee 过滤且多个条件为 AND', async () => {
    const { app, db } = createTestApp();
    insertCard(db, { id: 'card_match', type: 'task', status: 'default', lane: 'work', assignee: 'human' });
    insertCard(db, { id: 'card_type_miss', type: 'memo', status: 'default', lane: 'work', assignee: 'human' });
    insertCard(db, { id: 'card_status_miss', type: 'task', status: 'done', lane: 'work', assignee: 'human' });
    insertCard(db, { id: 'card_assignee_miss', type: 'task', status: 'default', lane: 'work', assignee: 'agent' });

    const res = await app.request('/cards?type=task&status=default&field.lane=work&field.assignee=human');
    const body = await readJson(res);

    expect(
      body.cards.map((card: any) => card.id),
      '多个过滤条件应按 AND 生效，只返回同时满足条件的卡。若失败：检查 WHERE 条件拼接',
    ).toEqual(['card_match']);
    expect(body.total, 'total 应为过滤后的总数。若失败：检查 count 查询是否复用相同 WHERE 条件').toBe(1);
  });

  it('GET /cards 默认分页 limit=50 offset=0，total 为过滤后的总数', async () => {
    const { app, db } = createTestApp();
    for (let index = 0; index < 55; index += 1) {
      insertCard(db, { id: `card_${String(index).padStart(2, '0')}`, created_at: index, updated_at: index });
    }

    const res = await app.request('/cards');
    const body = await readJson(res);

    expect(body.cards.length, '默认列表应只返回 50 张卡。若失败：检查默认 limit 是否为 50').toBe(50);
    expect(body.total, 'total 应返回过滤后的全部数量 55。若失败：检查 total 是否错误使用分页后长度').toBe(55);
    expect(
      body.countsByType.decision,
      '类型计数应统计分页前的匹配总数。若失败：检查 SidebarFilters 是否会把当前页 50 误当作 Decision 总数',
    ).toBe(55);
  });

  it('GET /cards?all=true 返回全部匹配卡片并忽略 limit 与 offset', async () => {
    const { app, db } = createTestApp();
    insertCard(db, { id: 'task_1', type: 'task' });
    insertCard(db, { id: 'task_2', type: 'task' });
    insertCard(db, { id: 'task_3', type: 'task' });
    insertCard(db, { id: 'memo_1', type: 'memo' });
    insertCard(db, { id: 'memo_2', type: 'memo' });

    const res = await app.request('/cards?type=task&all=true&limit=1&offset=2');
    const body = await readJson(res);

    expect(
      body.cards.length,
      'all=true 应忽略 limit 和 offset，返回全部匹配 task。若失败：检查分页分支',
    ).toBe(3);
    expect(body.total, 'all=true 的 total 应为匹配 task 总数。若失败：检查 total 查询过滤条件').toBe(3);
  });

  it('GET /cards 非法 limit 或 offset 返回 400 且 details 指出字段和原因', async () => {
    const { app } = createTestApp();
    const cases = [
      { path: '/cards?limit=0', field: 'limit' },
      { path: '/cards?limit=501', field: 'limit' },
      { path: '/cards?offset=-1', field: 'offset' },
    ];

    for (const item of cases) {
      const res = await app.request(item.path);
      const body = await readJson(res);
      expect(res.status, `${item.path} 应返回 400。若失败：检查 parsePagination 的边界校验`).toBe(400);
      expect(
        body.error.details.field,
        `${item.path} 应指出错误字段 ${item.field}。若失败：检查 pagination 错误 details`,
      ).toBe(item.field);
      expect(
        body.error.details.reason.length > 0,
        `${item.path} 应给出非空 reason。若失败：检查错误体 details.reason`,
      ).toBe(true);
    }
  });

  it('GET /cards 按 created_at DESC, id DESC 稳定排序', async () => {
    const { app, db } = createTestApp();
    insertCard(db, { id: 'card_old', created_at: 100, updated_at: 100 });
    insertCard(db, { id: 'card_same_b', created_at: 200, updated_at: 200 });
    insertCard(db, { id: 'card_same_a', created_at: 200, updated_at: 200 });
    insertCard(db, { id: 'card_new', created_at: 300, updated_at: 300 });

    const res = await app.request('/cards?all=true');
    const body = await readJson(res);

    expect(
      body.cards.map((card: any) => card.id),
      '列表应先按 created_at 倒序，再按 id 倒序稳定排序。若失败：检查 ORDER BY created_at DESC, id DESC',
    ).toEqual(['card_new', 'card_same_b', 'card_same_a', 'card_old']);
  });

  it('GET /cards/:id 存在返回 200，不存在返回 404', async () => {
    const { app, db } = createTestApp();
    insertCard(db, { id: 'card_found' });

    const foundRes = await app.request('/cards/card_found');
    const foundBody = await readJson(foundRes);
    expect(foundRes.status, '读取存在卡片应返回 200。若失败：检查 GET /cards/:id 路由是否注册').toBe(200);
    expect(foundBody.card.id, '读取存在卡片应返回目标 id。若失败：检查 findCardById 查询参数绑定').toBe(
      'card_found',
    );

    const missingRes = await app.request('/cards/card_missing');
    const missingBody = await readJson(missingRes);
    expect(missingRes.status, '读取不存在卡片应返回 404。若失败：检查 notFound 分支').toBe(404);
    expect(missingBody.error.code, '读取不存在卡片应返回 CARD_NOT_FOUND。若失败：检查 notFound 错误码').toBe(
      'CARD_NOT_FOUND',
    );
  });

  it('PATCH /cards/:id 可更新允许字段，更新后返回完整卡片', async () => {
    const { app, db } = createTestApp();
    const inserted = insertCard(db, { id: 'card_patch', updated_at: 100 });

    const res = await app.request('/cards/card_patch', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fields: {
          title: '更新后的标题',
          body: '更新后的正文',
          priority: 2,
          lane: 'doing',
          assignee: 'human',
        },
      }),
    });
    const body = await readJson(res);

    expect(res.status, 'PATCH 允许字段应返回 200。若失败：检查 PATCH /cards/:id 路由和 update schema').toBe(200);
    expect(body.card.fields.title, 'PATCH 后 title 应更新。若失败：检查 UPDATE SET title').toBe('更新后的标题');
    expect(body.card.fields.body, 'PATCH 后 body 应更新。若失败：检查 UPDATE SET body').toBe('更新后的正文');
    expect(body.card.fields.priority, 'PATCH 后 priority 应更新。若失败：检查 UPDATE SET priority').toBe(2);
    expect(body.card.fields.lane, 'PATCH 后 lane 应更新。若失败：检查 UPDATE SET lane').toBe('doing');
    expect(body.card.fields.assignee, 'PATCH 后 assignee 应更新。若失败：检查 UPDATE SET assignee').toBe('human');
    expect(
      body.card.updated_at >= inserted.updated_at,
      'PATCH 后 updated_at 应不早于旧值。若失败：检查 update repository 是否写 Date.now()',
    ).toBe(true);
  });

  it('PATCH /cards/:id 传入 status 返回 400 且不落库', async () => {
    const { app, db } = createTestApp();
    insertCard(db, { id: 'card_status', status: 'default' });

    const res = await app.request('/cards/card_status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    const body = await readJson(res);
    expect(res.status, 'PATCH status 应返回 400。若失败：检查 status 禁改逻辑是否在落库前执行').toBe(400);
    expect(body.error.code, 'PATCH status 应返回 STATUS_PATCH_FORBIDDEN。若失败：检查错误码映射').toBe(
      'STATUS_PATCH_FORBIDDEN',
    );

    const readRes = await app.request('/cards/card_status');
    const readBody = await readJson(readRes);
    expect(readBody.card.status, 'PATCH status 被拒后数据库 status 应仍为 default。若失败：检查是否错误落库').toBe(
      'default',
    );
  });

  it('PATCH /cards/:id 不存在返回 404', async () => {
    const { app } = createTestApp();

    const res = await app.request('/cards/card_missing', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { title: '不存在' } }),
    });
    const body = await readJson(res);

    expect(res.status, 'PATCH 不存在卡片应返回 404。若失败：检查 update 前是否确认卡片存在').toBe(404);
    expect(body.error.code, 'PATCH 不存在卡片应返回 CARD_NOT_FOUND。若失败：检查 notFound 错误码').toBe(
      'CARD_NOT_FOUND',
    );
  });
});

describe('阶段 2 配置驱动卡片 API', () => {
  it('POST /cards 拒绝未知卡片类型并接受 fields 请求体', async () => {
    const { app } = createTestApp();

    const invalidRes = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'unknown', fields: { title: '未知类型' } }),
    });
    const invalidBody = await readJson(invalidRes);
    expect(invalidRes.status, '未知 card type 应返回 400。若失败：检查 type 是否仍使用硬编码 enum').toBe(400);
    expect(
      invalidBody.error.details.field,
      '未知 card type 错误应指出 type。若失败：检查配置驱动 type 校验错误体',
    ).toBe('type');

    const res = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '配置驱动建卡', risk_level: 'high' } }),
    });
    const body = await readJson(res);
    expect(res.status, 'fields 请求体创建 task 应返回 201。若失败：检查 fields 归一化和 create action').toBe(201);
    expect(
      body.card.fields.risk_level,
      '阶段 1 之外字段 risk_level 应写入 fields 响应。若失败：检查 card_field_values 写入',
    ).toBe('high');
    expect(body.card.fields.title, 'title 应写入 fields。若失败：检查 fields 序列化').toBe('配置驱动建卡');
  });

  it('POST /cards 按 create action 拒绝未授权字段', async () => {
    const { app } = createTestApp();

    const forbiddenRes = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '非法字段', reply: '不该写' } }),
    });
    const forbiddenBody = await readJson(forbiddenRes);
    expect(
      forbiddenRes.status,
      'create action 未允许的字段应返回 400。若失败：检查 writableFields 校验',
    ).toBe(400);
    expect(
      forbiddenBody.error.details.field,
      '未授权字段错误应指出 reply。若失败：检查字段级错误详情',
    ).toBe('reply');
  });

  it('POST /cards 校验配置状态，未知状态返回 400', async () => {
    const { app } = createTestApp();

    const validRes = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', status: 'active', fields: { title: '活动状态卡片' } }),
    });
    const validBody = await readJson(validRes);
    expect(validRes.status, '配置中存在的 active 状态应允许建卡。若失败：检查 status 配置读取').toBe(201);
    expect(validBody.card.status, '显式 active 状态应写入响应。若失败：检查 cards.status 写入').toBe('active');

    const invalidRes = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', status: 'missing', fields: { title: '未知状态卡片' } }),
    });
    const invalidBody = await readJson(invalidRes);
    expect(invalidRes.status, '未知状态应返回 400。若失败：检查 status 配置校验').toBe(400);
    expect(invalidBody.error.details.field, '未知状态错误应指出 status。若失败：检查错误详情').toBe('status');
  });

  it('PATCH /cards/:id 按 update action 更新字段并拒绝 status 和未授权字段', async () => {
    const { app } = createTestApp();
    const createRes = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '待更新', risk_level: 'low' } }),
    });
    const created = await readJson(createRes);

    const updateRes = await app.request(`/cards/${created.card.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { title: '已更新', risk_level: 'high' } }),
    });
    const updated = await readJson(updateRes);
    expect(updateRes.status, 'update action 允许字段应更新成功。若失败：检查 PATCH fields 归一化').toBe(200);
    expect(updated.card.fields.risk_level, 'risk_level 应通过 PATCH 更新。若失败：检查字段值 upsert').toBe('high');
    expect(updated.card.fields.title, 'title 应通过 fields 更新。若失败：检查字段值 upsert').toBe('已更新');

    const statusRes = await app.request(`/cards/${created.card.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    expect(statusRes.status, 'PATCH status 仍应返回 400。若失败：检查 status 禁改兼容规则').toBe(400);

    const forbiddenRes = await app.request(`/cards/${created.card.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { reply: '非法 reply' } }),
    });
    const forbiddenBody = await readJson(forbiddenRes);
    expect(forbiddenRes.status, 'update action 未授权字段应返回 400。若失败：检查 update writableFields').toBe(400);
    expect(forbiddenBody.error.details.field, '未授权字段错误应指出 reply。若失败：检查错误详情').toBe('reply');
  });

  it('GET /cards 支持类型感知字段过滤并拒绝非法过滤', async () => {
    const { app } = createTestApp();
    await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '高风险', priority: 2, assignee: 'human', risk_level: 'high' } }),
    });
    await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '低风险', priority: 1, assignee: 'agent', risk_level: 'low' } }),
    });
    await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'decision', fields: { title: '选项卡', options: ['右侧抽屉', '单独详情页'] } }),
    });

    const riskRes = await app.request('/cards?field.risk_level=high&all=true');
    const riskBody = await readJson(riskRes);
    expect(
      riskBody.cards.map((card: any) => card.fields.title),
      'field.risk_level=high 应只返回高风险卡。若失败：检查 enum 字段过滤',
    ).toEqual(['高风险']);

    const aliasRes = await app.request('/cards?field.assignee=human&all=true');
    const aliasBody = await readJson(aliasRes);
    expect(
      aliasBody.cards.map((card: any) => card.fields.title),
      'field.assignee=human 应只返回负责人为 human 的卡。若失败：检查字段过滤',
    ).toEqual(['高风险']);

    const optionsRes = await app.request('/cards?field.options=右侧抽屉&all=true');
    const optionsBody = await readJson(optionsRes);
    expect(
      optionsBody.cards.map((card: any) => card.fields.title),
      'stringList 字段过滤应按列表包含匹配。若失败：检查 json_each 查询和 stringList 过滤解析',
    ).toEqual(['选项卡']);

    const numberRes = await app.request('/cards?field.priority=abc');
    const numberBody = await readJson(numberRes);
    expect(numberRes.status, 'number 字段过滤值无法解析时应返回 400。若失败：检查 kind 解析').toBe(400);
    expect(numberBody.error.details.field, '非法 number 过滤应指出 priority。若失败：检查错误详情').toBe('priority');

    const unknownRes = await app.request('/cards?field.unknown=value');
    const unknownBody = await readJson(unknownRes);
    expect(unknownRes.status, '未知字段过滤应返回 400。若失败：检查字段存在性校验').toBe(400);
    expect(unknownBody.error.details.field, '未知字段过滤应指出 unknown。若失败：检查错误详情').toBe('unknown');
  });

  it('PATCH /cards/:id 未变化字段不写入不记录 change', async () => {
    const { app, db } = createTestApp();
    insertCard(db, { id: 'card_noop', title: '不变标题' });

    const res = await app.request('/cards/card_noop', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { title: '不变标题' } }),
    });

    const body = await readJson(res);
    expect(
      res.status,
      '字段值未变化时 PATCH 应返回 200。若失败：检查后端 diff 是否正确跳过无变更请求',
    ).toBe(200);
    expect(
      body.change,
      '字段值未变化时 change 应为 null。若失败：检查后端 diff 是否在无变更时不记录 change',
    ).toBeNull();

    const changesRes = await app.request('/changes?since=0');
    const changesBody = await readJson(changesRes);
    const cardChanges = changesBody.changes.filter((c: any) => c.cardId === 'card_noop');
    expect(
      cardChanges.length,
      '无变更时不应产生任何 change 记录。若失败：检查后端 diff 是否在无变更时跳过 recordChange',
    ).toBe(0);
  });
});
