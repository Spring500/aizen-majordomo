import { describe, it, expect } from 'vitest';
import { createDb } from '../../src/db/index.ts';
import { createApp } from '../../src/app.ts';

// 行为:健康检查端点。用于确认服务存活与基本身份信息。
describe('GET /health 健康检查', () => {
  it('当服务正常运行时，返回 200 且 status 为 ok', async () => {
    // 假如:一个挂在全新内存库上的应用
    const app = createApp(createDb(':memory:'));

    // 当:请求 /health
    const res = await app.request('/health');

    // 那么:返回 200，且带 ok 状态与服务名、时间戳
    expect(
      res.status,
      '健康检查应返回 200。若失败：检查 createApp 是否注册了 /health 路由，或注入 db 的中间件是否抛错',
    ).toBe(200);

    const body: any = await res.json();
    expect(
      body.status,
      'status 应为 "ok"。若失败：说明 /health 返回体结构被改动，需同步本测试与处理器',
    ).toBe('ok');
    expect(
      body.name,
      'name 应为服务标识 "aizen-majordomo"。若失败：检查 /health 处理器里的常量是否被改名',
    ).toBe('aizen-majordomo');
    expect(
      typeof body.time,
      'time 应为毫秒时间戳(number)。若失败：检查处理器是否用 Date.now() 生成 time',
    ).toBe('number');
  });
});
