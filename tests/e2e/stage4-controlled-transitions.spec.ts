import { expect, test } from '@playwright/test';

async function createTask(page: import('@playwright/test').Page, title: string) {
  return page.evaluate(async (cardTitle) => {
    const res = await fetch('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ type: 'task', fields: { title: cardTitle } }),
    });
    if (!res.ok) throw new Error(`创建 task 失败: ${res.status}`);
    return ((await res.json()) as { card: { id: string } }).card.id;
  }, title);
}

async function createWaitingDecision(page: import('@playwright/test').Page, title: string) {
  return page.evaluate(async (cardTitle) => {
    const createRes = await fetch('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ type: 'decision', fields: { title: cardTitle } }),
    });
    if (!createRes.ok) throw new Error(`创建 decision 失败: ${createRes.status}`);
    const card = ((await createRes.json()) as { card: { id: string } }).card;
    const transitionRes = await fetch(`/cards/${card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ transitionId: 'request_reply' }),
    });
    if (!transitionRes.ok) throw new Error(`流转到 waiting 失败: ${transitionRes.status}`);
    return card.id;
  }, title);
}

test('阶段 4 宽屏可执行合法状态流转', async ({ page }) => {
  await page.goto('/');
  await createTask(page, '阶段四宽屏任务');
  await page.reload();

  await page.getByRole('button', { name: /阶段四宽屏任务/ }).click();
  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await drawer.getByRole('button', { name: '开始处理' }).click();

  await expect(
    drawer.getByLabel('Status'),
    '执行开始处理后详情中的状态应更新为处理中。若失败：检查 transition API 和详情刷新',
  ).toHaveValue('处理中');
});

test('阶段 4 宽屏提交回复会执行 submit_reply 流转', async ({ page }) => {
  await page.goto('/');
  await createWaitingDecision(page, '阶段四宽屏决策');
  await page.reload();

  await page.getByRole('button', { name: /阶段四宽屏决策/ }).click();
  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await drawer.getByLabel('正式回复').fill('采用方案 A');
  await drawer.getByRole('button', { name: '提交回复' }).click();

  await expect(
    drawer.getByLabel('Status'),
    '执行 submit_reply 后 decision 状态应变为已解决。若失败：检查 submit_reply transition',
  ).toHaveValue('已解决');
  await expect(drawer.getByText('采用方案 A'), '提交回复后回复内容应作为已保存回复展示').toBeVisible();
});

test('阶段 4 窄屏可打开详情并执行合法状态流转', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto('/');
  await createTask(page, '阶段四窄屏任务');
  await page.reload();

  await page.getByRole('button', { name: /阶段四窄屏任务/ }).click();
  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await drawer.getByRole('button', { name: '开始处理' }).click();

  await expect(
    drawer.getByLabel('Status'),
    '窄屏执行 transition 后详情状态应更新，不能因抽屉布局丢失核心能力',
  ).toHaveValue('处理中');
});
