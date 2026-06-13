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

  const filters = page.getByRole('complementary', { name: '筛选' });
  await filters.getByLabel('筛选风险等级').selectOption('low');

  await expect(
    page.getByRole('button', { name: /高风险配置卡/ }),
    '按 risk_level=low 过滤后应保留更新后的卡。若失败：检查字段过滤',
  ).toBeVisible();
});
