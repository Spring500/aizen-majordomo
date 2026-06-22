import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers.ts';

async function createDecision(app: ReturnType<typeof createTestApp>['app']) {
  const createRes = await app.request('/cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
    body: JSON.stringify({
      type: 'decision',
      fields: { title: '需要回复', options: ['A', 'B'] },
    }),
  });
  const card = (await createRes.json()).card;
  await app.request(`/cards/${card.id}/transition`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
    body: JSON.stringify({ transitionId: 'request_reply' }),
  });
  return (await (await app.request(`/cards/${card.id}`)).json()).card;
}

describe('POST /cards/:id/actions/reply', () => {
  it('人类可以对声明 reply action 的 decision 提交正式回复', async () => {
    const { app } = createTestApp();
    const card = await createDecision(app);

    const res = await app.request(`/cards/${card.id}/actions/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ fields: { reply: '选择 A' } }),
    });

    expect(res.status, '提交 decision 回复应成功，失败时检查 reply action 路由和配置校验').toBe(200);
    const body = await res.json();
    expect(body.card.fields.reply, '正式回复应持久化到 fields.reply').toBe('选择 A');
    expect(body.card.status, '阶段 3 回复不应自动修改状态').toBe('waiting');
    expect(body.change.event, '回复应写入 card.action.reply 事件').toBe('card.action.reply');
    expect(body.change.action, '回复事件应记录 action=reply，便于 agent 按动作识别').toBe('reply');
  });

  it('未声明 reply action 的类型不能提交正式回复', async () => {
    const { app } = createTestApp();
    const create = await app.request('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'task', fields: { title: '普通任务' } }),
    });
    const task = (await create.json()).card;

    const res = await app.request(`/cards/${task.id}/actions/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { reply: '不应允许' } }),
    });

    expect(res.status, 'task 未声明 reply action，应返回 400').toBe(400);
    const body = await res.json();
    expect(body.error.details.field, '错误详情应指向 action，便于 agent 知道动作不可用').toBe('action');
  });

  it('reply action 只能写入配置允许字段', async () => {
    const { app } = createTestApp();
    const card = await createDecision(app);

    const res = await app.request(`/cards/${card.id}/actions/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: { reply: '选择 A', title: '不允许改标题' } }),
    });

    expect(res.status, 'reply action 写入未允许字段应返回 400').toBe(400);
    const body = await res.json();
    expect(body.error.details.field, '错误详情应指出未允许字段 title').toBe('title');
  });
});
