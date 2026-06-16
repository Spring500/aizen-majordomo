import { expect, test } from '@playwright/test';

test('阶段 2 配置驱动字段、状态和过滤路径可用', async ({ page }) => {
  await page.goto('/config');
  await expect(
    page.getByText('risk_level'),
    '/config 应返回阶段 1 之外的 risk_level 字段。若失败：检查配置读取接口',
  ).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: '新建卡片' }).click();
  const dialog = page.getByRole('region', { name: '新建卡片' });
  await dialog.getByLabel('Status').selectOption('active');
  await dialog.getByLabel('标题').fill('高风险配置卡');
  await dialog.getByLabel('风险等级').selectOption('high');
  await dialog.getByRole('button', { name: '创建' }).click();

  await expect(
    page.getByRole('button', { name: /高风险配置卡/ }),
    '配置驱动建卡后列表应显示新卡。若失败：检查 create action 和前端动态表单',
  ).toBeVisible();

  await page.getByRole('button', { name: /高风险配置卡/ }).click();
  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await expect(
    drawer.getByLabel('Status'),
    '详情应显示配置状态字段。若失败：检查状态写入和详情渲染',
  ).toHaveValue('active');
  await drawer.getByLabel('风险等级').selectOption('low');
  await drawer.getByRole('button', { name: '保存' }).click();

  await page.getByRole('button', { name: '新建卡片' }).click();
  const secondDialog = page.getByRole('region', { name: '新建卡片' });
  await secondDialog.getByLabel('标题').fill('默认状态配置卡');
  await secondDialog.getByRole('button', { name: '创建' }).click();

  const filters = page.getByRole('complementary', { name: '筛选' });
  await filters.getByRole('button', { name: '处理中', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /高风险配置卡/ }),
    '点击状态筛选“处理中”后应显示 active 卡。若失败：检查 SidebarFilters status 参数和列表刷新',
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /默认状态配置卡/ }),
    '点击状态筛选“处理中”后不应显示 default 卡。若失败：检查 status 过滤是否生效',
  ).toHaveCount(0);

  await filters.getByRole('button', { name: '全部状态', exact: true }).click();
  await filters.getByRole('button', { name: '添加筛选条件' }).click();
  await filters.getByLabel('选择筛选字段').selectOption('risk_level');
  await filters.getByLabel('筛选风险等级的值').selectOption('low');
  await filters.getByRole('button', { name: '应用筛选' }).click();

  await expect(
    page.getByRole('button', { name: /高风险配置卡/ }),
    '按 risk_level=low 过滤后应保留更新后的卡。若失败：检查字段过滤',
  ).toBeVisible();
});

test('大量卡片只滚动列表区域且分页与控制栏保持可见', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    for (let index = 0; index < 60; index += 1) {
      const res = await fetch('/cards', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'task',
          fields: { title: `滚动验证卡 ${String(index).padStart(2, '0')}` },
        }),
      });
      if (!res.ok) throw new Error(`创建滚动验证卡失败: ${res.status}`);
    }
  });
  await page.reload();

  await expect(
    page.getByRole('navigation', { name: '卡片分页' }),
    '大量卡片时分页应保持在主面板底部可见。若失败：检查分页是否仍被卡片列表推到滚动区域底部',
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight),
    '大量卡片时浏览器页面本身不应滚动。若失败：检查 app/workspace 是否固定到视口高度',
  ).toBe(true);
  expect(
    await page.evaluate(() => {
      const list = document.querySelector('.card-list-scroll');
      return Boolean(list && list.scrollHeight > list.clientHeight);
    }),
    '卡片列表应拥有独立滚动区域。若失败：检查 CardList 是否被包在 .card-list-scroll 中',
  ).toBe(true);
  await expect(
    page.getByRole('button', { name: '新建卡片' }),
    '列表滚动时顶部新建入口应保持可见。若失败：检查 topbar 是否被页面滚动带走',
  ).toBeVisible();
});
