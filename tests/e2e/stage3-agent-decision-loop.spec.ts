import { expect, test } from '@playwright/test';

async function createWaitingDecision(page: import('@playwright/test').Page, title: string) {
  return page.evaluate(async (cardTitle) => {
    const createRes = await fetch('/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({
        type: 'decision',
        fields: { title: cardTitle, options: ['采用 A', '采用 B'] },
      }),
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

test('阶段 3 宽屏可筛出等待回复 decision 并提交正式回复', async ({ page }) => {
  await page.goto('/');
  await createWaitingDecision(page, '阶段三宽屏决策');
  await page.reload();

  const filters = page.getByRole('complementary', { name: '筛选' });
  await filters.getByRole('button', { name: '等待回复', exact: true }).click();
  await page.getByRole('button', { name: /阶段三宽屏决策/ }).click();

  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await drawer.getByLabel('正式回复').fill('采用方案 A');
  await drawer.getByRole('button', { name: '提交回复' }).click();

  await expect(
    drawer.getByText('采用方案 A'),
    '提交正式回复后详情应显示回复内容。若失败：检查 submit_reply transition 和 CardDrawer 刷新',
  ).toBeVisible();
});

test('阶段 3 窄屏可通过筛选抽屉提交正式回复', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 720 });
  await page.goto('/');
  await createWaitingDecision(page, '阶段三窄屏决策');
  await page.reload();

  await page.getByRole('button', { name: '筛选', exact: true }).click();
  const filters = page.getByRole('complementary', { name: '筛选' });
  await filters.getByRole('button', { name: '等待回复', exact: true }).click();
  await page.getByRole('button', { name: /阶段三窄屏决策/ }).click();

  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await drawer.getByLabel('正式回复').fill('窄屏采用方案 B');
  await drawer.getByRole('button', { name: '提交回复' }).click();

  await expect(
    drawer.getByText('窄屏采用方案 B'),
    '窄屏提交正式回复后详情应显示回复内容。若失败：检查窄屏详情抽屉和回复区',
  ).toBeVisible();
});
