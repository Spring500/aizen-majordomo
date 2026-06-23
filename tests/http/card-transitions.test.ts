import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.ts';

async function createTask(app: ReturnType<typeof createTestApp>['app']) {
  const res = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
    body: JSON.stringify({ type: 'task', fields: { title: '阶段四任务' } }),
  });
  return (await res.json()).card;
}

async function createDefaultDecision(app: ReturnType<typeof createTestApp>['app']) {
  const res = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
    body: JSON.stringify({ type: 'decision', fields: { title: '默认状态决策' } }),
  });
  return (await res.json()).card;
}

async function createWaitingDecision(app: ReturnType<typeof createTestApp>['app']) {
  const res = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
    body: JSON.stringify({ type: 'decision', status: 'waiting', fields: { title: '需要回复' } }),
  });
  return (await res.json()).card;
}

describe('POST /cards/:id/transition', () => {
  it('合法 transition 会把卡片状态改为目标状态', async () => {
    const { app } = createTestApp();
    const card = await createTask(app);

    const res = await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ transitionId: 'start' }),
    });
    const body = await res.json();

    expect(res.status, 'default 状态 task 执行 start 应成功').toBe(200);
    expect(body.card.status, 'start transition 应把状态推进到 active').toBe('active');
    expect(body.change.event, '状态流转应写入可被 agent 识别的 transition 事件').toBe('card.transition.start');
  });

  it('transition 不存在时返回 404', async () => {
    const { app } = createTestApp();
    const card = await createTask(app);

    const res = await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transitionId: 'missing_transition' }),
    });

    expect(res.status, '未知 transitionId 应返回 404，避免伪装成字段校验错误').toBe(404);
  });

  it('当前状态不满足 fromStatus 时返回 409', async () => {
    const { app } = createTestApp();
    const card = await createDefaultDecision(app);

    const res = await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transitionId: 'submit_reply', fields: { reply: '不应允许' } }),
    });
    const body = await res.json();

    expect(res.status, 'default 状态不满足 submit_reply 的 waiting 来源状态，应返回 409').toBe(409);
    expect(body.error.details.field, '冲突错误详情应指向 status，便于调用方理解当前状态不允许').toBe('status');
  });

  it('目标状态与当前状态相同时返回 409，禁止自环', async () => {
    const { app } = createTestApp();
    const card = await createTask(app);

    await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ transitionId: 'complete' }),
    });

    const res = await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ transitionId: 'complete' }),
    });
    const body = await res.json();

    expect(res.status, '已处于 done 状态再执行 complete 应返回 409，禁止自环').toBe(409);
    expect(body.error.details.field, '自环冲突错误详情应指向 status').toBe('status');
  });

  it('全局 transition 能从任意状态执行', async () => {
    const { app } = createTestApp();
    const card = await createTask(app);

    const res = await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transitionId: 'complete' }),
    });
    const body = await res.json();

    expect(res.status, 'complete 的 fromStatus 为 null，应允许从 default 直接执行').toBe(200);
    expect(body.card.status, 'complete transition 应把卡片状态改为 done').toBe('done');
  });

  it('transition 可随请求写入允许字段', async () => {
    const { app } = createTestApp();
    const card = await createWaitingDecision(app);

    const res = await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ transitionId: 'submit_reply', fields: { reply: '采用 A' } }),
    });
    const body = await res.json();

    expect(res.status, 'waiting decision 执行 submit_reply 并写入 reply 应成功').toBe(200);
    expect(body.card.status, 'submit_reply 应把 decision 状态改为 resolved').toBe('resolved');
    expect(body.card.fields.reply, 'submit_reply 应持久化 reply 字段').toBe('采用 A');
  });

  it('transition 请求携带未允许字段时返回 400 且不写入卡片', async () => {
    const { app } = createTestApp();
    const card = await createWaitingDecision(app);

    const res = await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transitionId: 'submit_reply', fields: { reply: '采用 A', title: '不允许改标题' } }),
    });
    const body = await res.json();
    const after = await (await app.request(`/cards/${card.id}`)).json();

    expect(res.status, 'transition 写入未声明字段应返回 400').toBe(400);
    expect(body.error.details.field, '错误详情应指出未允许字段 title').toBe('title');
    expect(after.card.status, '字段校验失败时不应修改状态').toBe('waiting');
    expect(after.card.fields.title, '字段校验失败时不应写入未允许的新标题').toBe('需要回复');
  });

  it('transition 可附带评论并保存', async () => {
    const { app, db } = createTestApp();
    const card = await createTask(app);

    const res = await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ transitionId: 'start', comment: '开始处理这个任务' }),
    });
    const body = await res.json();
    const row = db.prepare('SELECT * FROM comments WHERE card_id = @card_id').get({ card_id: card.id }) as any;

    expect(res.status, '带 comment 的合法 transition 应成功').toBe(200);
    expect(body.comment.content, '响应应返回本次保存的评论内容').toBe('开始处理这个任务');
    expect(row.content, 'transition 附带评论应写入 comments 表').toBe('开始处理这个任务');
    expect(row.author, '评论作者应使用 X-Actor').toBe('human');
  });

  it('transition 写入 changes，agent 可通过 since 游标读取', async () => {
    const { app } = createTestApp();
    const card = await createTask(app);
    const before = await (await app.request('/changes?since=0')).json();

    await app.request(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ transitionId: 'start' }),
    });
    const body = await (await app.request(`/changes?since=${before.latestSeq}`)).json();

    expect(body.changes.length, '从 transition 前游标读取应只返回本次状态流转事件').toBe(1);
    expect(body.changes[0].event, 'transition 事件名应包含 transition id').toBe('card.transition.start');
    expect(body.changes[0].payload.fromStatus, 'transition changes payload 应包含来源状态').toBe('default');
    expect(body.changes[0].payload.toStatus, 'transition changes payload 应包含目标状态').toBe('active');
  });
});
