import { describe, expect, it } from 'vitest';
import { createDb } from '../../src/db/index.ts';
import { createTestApp, readJson } from './helpers.ts';
import { initializeConfig } from '../../src/config/initialize.ts';
import { SAMPLE_CONFIG } from '../../src/config/sample.ts';
import { validateConfig } from '../../src/config/validation.ts';

describe('阶段 2 配置模型', () => {
  it('GET /config 返回样例卡片类型、状态、流转和 hook action model', async () => {
    const { app } = createTestApp();

    const res = await app.request('/config');
    const body = await readJson(res);

    expect(res.status, 'GET /config 应返回 200。若失败：检查 config 路由是否挂载').toBe(200);
    expect(
      body.cardTypes.map((item: any) => item.id),
      '配置应包含 task/decision/memo 三种样例类型。若失败：检查样例配置初始化',
    ).toEqual(['task', 'decision', 'memo']);
    expect(
      body.statuses.some((item: any) => item.id === 'waiting'),
      '配置应包含 waiting 状态。若失败：检查 statuses seed',
    ).toBe(true);
    expect(
      body.transitions.some((item: any) => item.id === 'submit_reply'),
      '配置应包含 submit_reply 流转。若失败：检查 transitions seed',
    ).toBe(true);
    expect(
      body.hookActionModels.map((item: any) => item.id).sort(),
      'hook action model 应包含 script/transition/webhook。若失败：检查 hook action model seed',
    ).toEqual(['script', 'transition', 'webhook']);
  });

  it('配置初始化可重复执行并覆盖同 id 样例配置', () => {
    const db = createDb(':memory:');
    db.prepare("UPDATE card_types SET name = '临时名称' WHERE id = 'task'").run();

    initializeConfig(db);

    const row = db.prepare("SELECT name FROM card_types WHERE id = 'task'").get() as { name: string };
    const count = db.prepare("SELECT COUNT(*) AS count FROM card_types WHERE id = 'task'").get() as { count: number };
    expect(row.name, '重复初始化应按样例配置覆盖 task 名称。若失败：检查 upsert 是否只插入不更新').toBe(
      'Task',
    );
    expect(count.count, '重复初始化不应产生重复 card_types。若失败：检查主键或 upsert 逻辑').toBe(1);
  });

  it('样例配置能表达字段、动作、decision 回复能力和 risk_level 扩展字段', () => {
    const decision = SAMPLE_CONFIG.cardTypes.find((item) => item.id === 'decision');
    const task = SAMPLE_CONFIG.cardTypes.find((item) => item.id === 'task');

    expect(decision, '样例配置应包含 decision。若失败：检查 SAMPLE_CONFIG.cardTypes').toBeTruthy();
    expect(
      decision?.fields.some((field) => field.id === 'reply'),
      'decision 应声明 reply 字段。若失败：检查 decision 字段能力',
    ).toBe(true);
    expect(
      decision?.actions.some((action) => action.id === 'reply' && action.writableFields.includes('reply')),
      'decision 应声明 reply 动作且允许写 reply。若失败：检查 action 配置',
    ).toBe(true);
    expect(
      task?.fields.some((field) => field.id === 'risk_level' && field.kind === 'enum'),
      'task 应包含阶段 1 之外的 enum 字段 risk_level。若失败：检查扩展验收字段',
    ).toBe(true);
  });

  it('无效配置引用会校验失败', () => {
    const invalid = structuredClone(SAMPLE_CONFIG);
    const firstAction = invalid.cardTypes[0]?.actions[0];
    if (!firstAction) throw new Error('测试前置失败：样例配置缺少第一个 action');
    firstAction.writableFields.push('missing_field');

    const result = validateConfig(invalid);

    expect(result.ok, 'action 引用不存在字段时配置校验应失败。若失败：检查 action field 引用校验').toBe(false);
    expect(
      result.ok ? '' : (result.errors[0] ?? '').includes('missing_field'),
      '错误信息应指出 missing_field。若失败：检查配置校验错误详情',
    ).toBe(true);
  });
});
