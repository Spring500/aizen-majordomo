import { expect, test } from '@playwright/test';

test('阶段 1 页面可创建、查看、编辑、筛选卡片并显示错误', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByText('还没有卡片'),
    '空库首页应显示可理解空状态。若失败：检查 Hono 是否托管前端，以及 React 是否成功请求 /cards',
  ).toBeVisible();

  await page.getByRole('button', { name: '新建卡片' }).click();
  let dialog = page.getByRole('region', { name: '新建卡片' });
  await dialog.getByLabel('标题').fill('第一张 task');
  await dialog.getByLabel('正文').fill('通过浏览器记录真实事项');
  await dialog.getByRole('button', { name: '创建' }).click();

  await expect(
    page.getByRole('button', { name: /第一张 task/ }),
    '创建 task 后列表应出现该标题。若失败：检查 POST /cards 或列表刷新逻辑',
  ).toBeVisible();

  await page.getByRole('button', { name: '新建卡片' }).click();
  dialog = page.getByRole('region', { name: '新建卡片' });
  await dialog.getByLabel('类型').selectOption('decision');
  await dialog.getByLabel('标题').fill('选择详情形态');
  await dialog.getByLabel('选项').fill('右侧抽屉\n单独详情页');
  await dialog.getByRole('button', { name: '创建' }).click();
  await page.getByRole('button', { name: /选择详情形态/ }).click();

  await expect(
    page.getByText('右侧抽屉'),
    'decision 详情应显示 options。若失败：检查 options 创建、读取和抽屉渲染',
  ).toBeVisible();

  await page.getByRole('button', { name: '新建卡片' }).click();
  dialog = page.getByRole('region', { name: '新建卡片' });
  await dialog.getByLabel('类型').selectOption('memo');
  await dialog.getByLabel('标题').fill('一条 memo');
  await dialog.getByRole('button', { name: '创建' }).click();

  await expect(
    page.getByRole('button', { name: /一条 memo/ }),
    '创建 memo 后列表应显示 memo 标题。若失败：检查 memo 创建和列表刷新逻辑',
  ).toBeVisible();

  await page.getByRole('button', { name: /第一张 task/ }).click();
  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await drawer.getByLabel('负责人').fill('human');
  await drawer.getByLabel('优先级').fill('1');
  await drawer.getByRole('button', { name: '保存' }).click();

  await expect(
    page.getByText('human').first(),
    '保存负责人后列表或详情应显示 human。若失败：检查 PATCH /cards/:id 和前端刷新逻辑',
  ).toBeVisible();

  await page.getByRole('complementary', { name: '筛选' }).getByRole('button', { name: 'Task', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /第一张 task/ }),
    '选择 Task 筛选后应保留 task 卡。若失败：检查 type 筛选参数',
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /一条 memo/ }),
    '选择 Task 筛选后不应显示 memo。若失败：检查筛选刷新和列表渲染',
  ).toHaveCount(0);

  await page.getByRole('button', { name: '新建卡片' }).click();
  dialog = page.getByRole('region', { name: '新建卡片' });
  await dialog.getByRole('button', { name: '创建' }).click();

  await expect(
    page.getByText('标题不能为空'),
    '空标题创建应显示后端错误。若失败：检查错误体解析和表单错误展示位置',
  ).toBeVisible();
});

test('阶段 1 窄屏布局保留筛选、详情抽屉、新建和错误提示能力', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto('/');

  await page.getByRole('button', { name: '新建卡片' }).click();
  let dialog = page.getByRole('region', { name: '新建卡片' });
  await dialog.getByLabel('标题').fill('窄屏 task');
  await dialog.getByLabel('正文').fill('用于验证竖屏布局能力对位');
  await dialog.getByRole('button', { name: '创建' }).click();

  await expect(
    page.getByRole('button', { name: /窄屏 task/ }),
    '窄屏创建后列表应显示 task。若失败：检查窄屏新建入口是否和宽屏共享创建逻辑',
  ).toBeVisible();

  await page.getByRole('button', { name: '筛选', exact: true }).click();
  const filterPanel = page.getByRole('complementary', { name: '筛选' });
  await expect(
    filterPanel,
    '窄屏点击筛选按钮应打开筛选面板。若失败：检查移动端左侧筛选面板是否可呼出',
  ).toBeVisible();
  await filterPanel.getByRole('button', { name: 'Task', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /窄屏 task/ }),
    '窄屏筛选 Task 后仍应显示 task 卡片。若失败：检查筛选面板和列表刷新是否对位宽屏',
  ).toBeVisible();

  await page.getByRole('button', { name: /窄屏 task/ }).click();
  const drawer = page.getByRole('complementary', { name: '卡片详情' });
  await expect(
    drawer,
    '窄屏点击卡片后应打开右侧详情抽屉。若失败：检查选卡后移动端 drawer open 状态',
  ).toBeVisible();
  await drawer.getByLabel('负责人').fill('human');
  await drawer.getByRole('button', { name: '保存' }).click();
  await expect(
    drawer.getByText('配置允许字段可编辑'),
    '窄屏详情抽屉应复用宽屏编辑保存能力。若失败：检查 CardDrawer 保存状态和 PATCH 调用',
  ).toBeVisible();
  await drawer.getByRole('button', { name: '关闭详情' }).click();
  await expect(
    drawer,
    '窄屏关闭详情后抽屉应隐藏，不应继续遮挡列表。若失败：检查关闭按钮和 drawer open 状态',
  ).toBeHidden();

  await page.getByRole('button', { name: '新建卡片' }).click();
  dialog = page.getByRole('region', { name: '新建卡片' });
  await dialog.getByRole('button', { name: '创建' }).click();
  await expect(
    dialog.getByText('标题不能为空'),
    '窄屏新建空标题应显示同样的后端错误。若失败：检查移动端新建面板是否复用错误展示',
  ).toBeVisible();
});
