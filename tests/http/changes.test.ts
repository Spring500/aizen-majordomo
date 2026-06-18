import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.ts';

describe('GET /changes', () => {
  it('空库从 0 开始读取时返回空变化列表', async () => {
    const { app } = createTestApp();

    const res = await app.request('/changes?since=0');
    expect(res.status, '空库读取 changes 应该成功，失败时检查 /changes 路由是否挂载').toBe(200);

    const body = await res.json();
    expect(body.changes, '空库没有事件，changes 应该是空数组').toEqual([]);
    expect(body.latestSeq, '空库 latestSeq 应该为 0，便于 agent 保存游标').toBe(0);
  });

  it('非法 since 返回 400 并指出字段', async () => {
    const { app } = createTestApp();

    const res = await app.request('/changes?since=-1');
    expect(res.status, '非法 since 应返回 400，失败时检查 parseSince 校验').toBe(400);

    const body = await res.json();
    expect(body.error.details.field, '错误详情应指出 since，便于 agent 修正请求').toBe('since');
  });

  it('创建卡片写入 card.created 事件', async () => {
    const { app } = createTestApp();
    const create = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ type: 'task', fields: { title: '记录创建事件' } }),
    });
    const created = await create.json();

    const res = await app.request('/changes?since=0');
    const body = await res.json();

    expect(res.status, '读取创建后的 changes 应成功，失败时检查 changes 路由').toBe(200);
    expect(body.changes[0].event, '创建卡片应写入 card.created 事件').toBe('card.created');
    expect(body.changes[0].cardId, '创建事件应包含新卡片 id').toBe(created.card.id);
    expect(body.changes[0].actor, '创建事件应记录 X-Actor').toBe('agent');
    expect(body.changes[0].seq, '创建事件应包含递增 seq，供 agent 作为游标').toBe(1);
    expect(body.changes[0].at > 0, '创建事件应包含时间戳 at，供 agent 判断发生时间').toBe(true);
  });

  it('编辑卡片写入 card.updated 事件且 since 游标只返回新变化', async () => {
    const { app } = createTestApp();
    const create = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '原标题' } }),
    });
    const created = await create.json();
    const firstChanges = await (await app.request('/changes?since=0')).json();
    const lastSeq = firstChanges.latestSeq;

    await app.request(`/cards/${created.card.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ fields: { title: '新标题' } }),
    });
    const res = await app.request(`/changes?since=${lastSeq}`);
    const body = await res.json();

    expect(body.changes.length, '从上次游标读取应只返回编辑后的新事件').toBe(1);
    expect(body.changes[0].event, '编辑卡片应写入 card.updated 事件').toBe('card.updated');
    expect(body.changes[0].payload.fields.title, '编辑事件 payload 应包含本次写入字段').toBe('新标题');
    expect(body.changes[0].actor, '编辑事件应记录 X-Actor').toBe('human');
  });

  it('GET /changes?since=0 按 seq 升序返回多条变化', async () => {
    const { app } = createTestApp();
    await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ type: 'task', fields: { title: '第一张' } }),
    });
    await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ type: 'task', fields: { title: '第二张' } }),
    });

    const body = await (await app.request('/changes?since=0')).json();

    expect(
      body.changes.map((change: any) => change.seq),
      'changes 应按 seq 升序返回。若失败：检查 /changes 查询 ORDER BY seq ASC',
    ).toEqual([1, 2]);
    expect(
      body.changes.map((change: any) => change.payload.fields.title),
      '按 seq 升序返回时 payload 顺序应与创建顺序一致。若失败：检查是否按 updated_at 排序',
    ).toEqual(['第一张', '第二张']);
  });

  it('回复 decision 后可从 /changes 读取 card.action.reply 事件', async () => {
    const { app } = createTestApp();
    const create = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ type: 'decision', status: 'waiting', fields: { title: '需要回复' } }),
    });
    const created = await create.json();
    const beforeReply = await (await app.request('/changes?since=0')).json();

    await app.request(`/cards/${created.card.id}/actions/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ fields: { reply: '选择 A', replied_by: 'human' } }),
    });
    const body = await (await app.request(`/changes?since=${beforeReply.latestSeq}`)).json();

    expect(body.changes.length, '从回复前游标读取应只返回回复事件。若失败：检查 reply 是否写入 changes').toBe(1);
    expect(body.changes[0].event, '回复事件应能通过 /changes 读取。若失败：检查 recordChange 事件名').toBe(
      'card.action.reply',
    );
    expect(body.changes[0].action, '回复事件 action 应为 reply。若失败：检查 action 字段写入').toBe('reply');
    expect(body.changes[0].payload.fields.reply, '回复事件 payload 应包含 reply 内容。若失败：检查 payload.fields').toBe(
      '选择 A',
    );
  });

  it('changes 游标使用 seq 而不是 updated_at', async () => {
    const { app, db } = createTestApp();
    const first = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '旧 updated_at 后创建' } }),
    });
    const firstCard = (await first.json()).card;
    const firstChanges = await (await app.request('/changes?since=0')).json();
    db.prepare('UPDATE cards SET updated_at = @updated_at WHERE id = @id').run({ id: firstCard.id, updated_at: 999999 });

    const second = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '新 seq 低 updated_at' } }),
    });
    const secondCard = (await second.json()).card;
    db.prepare('UPDATE cards SET updated_at = @updated_at WHERE id = @id').run({ id: secondCard.id, updated_at: 1 });

    const body = await (await app.request(`/changes?since=${firstChanges.latestSeq}`)).json();

    expect(body.changes.length, '使用第一个 seq 游标后应返回第二次创建事件。若失败：检查是否错误依赖 updated_at').toBe(1);
    expect(body.changes[0].cardId, 'seq 游标应返回第二张卡事件，不受 updated_at 大小影响').toBe(secondCard.id);
    expect(body.changes[0].seq > firstChanges.latestSeq, '返回事件的 seq 应大于 since。若失败：检查 WHERE seq > since').toBe(
      true,
    );
  });
});
