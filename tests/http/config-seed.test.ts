import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeConfig } from '../../src/config/initialize.ts';
import { createDb } from '../../src/db/index.ts';
import { loadSeedConfig } from '../../src/config/load-seed.ts';
import { readConfig } from '../../src/config/repository.ts';

const originalSeedPath = process.env.CONFIG_SEED_PATH;

afterEach(() => {
  if (originalSeedPath === undefined) {
    delete process.env.CONFIG_SEED_PATH;
  } else {
    process.env.CONFIG_SEED_PATH = originalSeedPath;
  }
});

describe('阶段 2 配置种子加载', () => {
  it('未指定 CONFIG_SEED_PATH 时读取 default-sample 场景配置', () => {
    delete process.env.CONFIG_SEED_PATH;

    const config = loadSeedConfig();

    expect(
      config.cardTypes.map((item) => item.id),
      '默认配置应来自 default-sample 场景并包含 task/decision/memo。若失败：检查默认场景配置加载路径',
    ).toEqual(['task', 'decision', 'memo']);
    expect(
      config.statuses.some((item) => item.id === 'waiting'),
      '默认配置应包含 waiting 状态。若失败：检查 default-sample/config.json 内容',
    ).toBe(true);
  });

  it('重复初始化 statuses 和 transitions 不产生重复数据', () => {
    delete process.env.CONFIG_SEED_PATH;
    const db = createDb(':memory:');
    const seed = loadSeedConfig();

    initializeConfig(db);
    initializeConfig(db);

    const statusCount = db.prepare('SELECT COUNT(*) AS total FROM statuses').get() as { total: number };
    const transitionCount = db.prepare('SELECT COUNT(*) AS total FROM transitions').get() as { total: number };

    expect(statusCount.total, '重复初始化后 statuses 数量应等于样例配置数量，不能插入重复状态').toBe(seed.statuses.length);
    expect(transitionCount.total, '重复初始化后 transitions 数量应等于样例配置数量，不能插入重复流转').toBe(
      seed.transitions.length,
    );
  });

  it('指定 CONFIG_SEED_PATH 时使用该 JSON 初始化数据库配置', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aizen-seed-'));
    const seedPath = join(dir, 'custom-config.json');
    writeFileSync(
      seedPath,
      JSON.stringify({
        cardTypes: [
          {
            id: 'review',
            name: 'Review',
            fields: [{ id: 'title', label: '标题', kind: 'text', required: true }],
            actions: [{ id: 'create', label: '创建', kind: 'create', writableFields: ['title'], requiredFields: ['title'] }],
            enabled: true,
            system: true,
            position: 1,
          },
        ],
        statuses: [{ id: 'triage', name: '分拣', position: 0, enabled: true, system: true }],
        transitions: [],
        hookActionModels: [],
        hooks: [],
      }),
      'utf8',
    );
    process.env.CONFIG_SEED_PATH = seedPath;

    const db = createDb(':memory:');
    const config = readConfig(db);

    expect(
      config.cardTypes.map((item) => item.id),
      '指定 CONFIG_SEED_PATH 后数据库应初始化为指定配置。若失败：检查 initializeConfig 是否调用 loadSeedConfig',
    ).toEqual(['review']);
    expect(
      config.statuses.map((item) => item.id),
      '指定 CONFIG_SEED_PATH 后状态也应来自指定配置。若失败：检查配置种子是否完整写入数据库',
    ).toEqual(['triage']);
  });
});
