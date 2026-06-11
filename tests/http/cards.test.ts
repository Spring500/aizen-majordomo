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
      '空看板应返回 {cards:[],total:0}。若失败：检查空库查询路径或 serialize() 是否对空结果出错',
    ).toEqual({ cards: [], total: 0 });
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
      body.cards[0].options,
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
      body: JSON.stringify({ type: 'task', title: '补齐卡片 API', body: '阶段 1 后端能力' }),
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
      body.card.title,
      '返回标题应为请求标题。若失败：检查 title trim 与 INSERT/serialize 字段映射',
    ).toBe('补齐卡片 API');
    expect(
      Object.keys(body.card).sort(),
      '创建响应应包含完整卡片字段。若失败：检查 serializeCard 是否漏掉 schema 中的字段',
    ).toEqual(
      [
        'assignee',
        'body',
        'created_at',
        'created_by',
        'id',
        'lane',
        'options',
        'priority',
        'replied_by',
        'reply',
        'status',
        'title',
        'type',
        'updated_at',
      ].sort(),
    );
  });

  it('POST /cards 创建 decision 时保存 options，读取时 options 为数组', async () => {
    const { app } = createTestApp();

    const res = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'decision',
        title: '阶段 1 前端详情用什么形态',
        options: ['右侧抽屉', '单独详情页'],
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
      body.card.options,
      'decision 的 options 应在响应中解析为数组。若失败：检查 options 持久化和 serializeCard',
    ).toEqual(['右侧抽屉', '单独详情页']);

    const readRes = await app.request(`/cards/${body.card.id}`);
    const readBody = await readJson(readRes);
    expect(
      readBody.card.options,
      'GET /cards/:id 读取 decision 时 options 仍应是数组。若失败：检查单卡读取是否复用统一序列化',
    ).toEqual(['右侧抽屉', '单独详情页']);
  });

  it('POST /cards 创建 memo 成功且忽略非 decision 的 options', async () => {
    const { app } = createTestApp();

    const res = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'memo', title: '记录一个观察', options: ['不应保存'] }),
    });

    const body = await readJson(res);
    expect(res.status, '创建 memo 应返回 201。若失败：检查 create schema 是否接受 memo').toBe(201);
    expect(body.card.type, '创建 memo 后响应 type 应保持 memo。若失败：检查 INSERT 参数绑定').toBe('memo');
    expect(
      body.card.options,
      '非 decision 的 options 应被忽略并返回 null。若失败：检查 create repository 的 options 归一化',
    ).toBeNull();
  });

  it('POST /cards 缺少 type、非法 type、缺少 title、纯空白 title 均返回 400 并指出字段', async () => {
    const { app } = createTestApp();
    const cases = [
      { name: '缺少 type', input: { title: '无类型' }, field: 'type' },
      { name: '非法 type', input: { type: 'bug', title: '非法类型' }, field: 'type' },
      { name: '缺少 title', input: { type: 'task' }, field: 'title' },
      { name: '纯空白 title', input: { type: 'task', title: '   ' }, field: 'title' },
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
      body: JSON.stringify({ type: 'task', title: '带 actor 创建' }),
    });
    const withActorBody = await readJson(withActorRes);
    expect(
      withActorBody.card.created_by,
      '带 X-Actor 创建时 created_by 应使用 header 值。若失败：检查 c.req.header("X-Actor") 读取',
    ).toBe('codex');

    const defaultActorRes = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', title: '默认 actor 创建' }),
    });
    const defaultActorBody = await readJson(defaultActorRes);
    expect(
      defaultActorBody.card.created_by,
      '未传 X-Actor 时 created_by 应为 human。若失败：检查 DEFAULT_ACTOR 默认值',
    ).toBe('human');
  });

  it('GET /cards 支持 type、status、lane、assignee 过滤且多个条件为 AND', async () => {
    const { app, db } = createTestApp();
    insertCard(db, { id: 'card_match', type: 'task', status: 'default', lane: 'work', assignee: 'human' });
    insertCard(db, { id: 'card_type_miss', type: 'memo', status: 'default', lane: 'work', assignee: 'human' });
    insertCard(db, { id: 'card_status_miss', type: 'task', status: 'done', lane: 'work', assignee: 'human' });
    insertCard(db, { id: 'card_assignee_miss', type: 'task', status: 'default', lane: 'work', assignee: 'agent' });

    const res = await app.request('/cards?type=task&status=default&lane=work&assignee=human');
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
        title: '更新后的标题',
        body: '更新后的正文',
        priority: 2,
        lane: 'doing',
        assignee: 'human',
      }),
    });
    const body = await readJson(res);

    expect(res.status, 'PATCH 允许字段应返回 200。若失败：检查 PATCH /cards/:id 路由和 update schema').toBe(200);
    expect(body.card.title, 'PATCH 后 title 应更新。若失败：检查 UPDATE SET title').toBe('更新后的标题');
    expect(body.card.body, 'PATCH 后 body 应更新。若失败：检查 UPDATE SET body').toBe('更新后的正文');
    expect(body.card.priority, 'PATCH 后 priority 应更新。若失败：检查 UPDATE SET priority').toBe(2);
    expect(body.card.lane, 'PATCH 后 lane 应更新。若失败：检查 UPDATE SET lane').toBe('doing');
    expect(body.card.assignee, 'PATCH 后 assignee 应更新。若失败：检查 UPDATE SET assignee').toBe('human');
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
      body: JSON.stringify({ title: '不存在' }),
    });
    const body = await readJson(res);

    expect(res.status, 'PATCH 不存在卡片应返回 404。若失败：检查 update 前是否确认卡片存在').toBe(404);
    expect(body.error.code, 'PATCH 不存在卡片应返回 CARD_NOT_FOUND。若失败：检查 notFound 错误码').toBe(
      'CARD_NOT_FOUND',
    );
  });
});
