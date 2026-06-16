import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { describe, expect, it } from 'vitest';

describe('启动错误处理', () => {
  it('端口被占用时输出中文说明并保留原始堆栈', async () => {
    const holder = createServer();
    holder.listen(0, '::');
    await once(holder, 'listening');
    const address = holder.address();
    if (!address || typeof address === 'string') throw new Error('测试前置失败：无法获取临时端口');

    const child = spawn(
      process.execPath,
      ['--experimental-sqlite', '--no-warnings', '--import', 'tsx', 'src/index.ts'],
      {
        cwd: process.cwd(),
        env: { ...process.env, PORT: String(address.port), DB_PATH: ':memory:' },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    const chunks: Buffer[] = [];
    child.stdout.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const cleanup = setTimeout(() => child.kill(), 10_000);
    const [code] = (await once(child, 'exit')) as [number | null];
    clearTimeout(cleanup);
    holder.close();

    const output = Buffer.concat(chunks).toString('utf8');
    expect(code, '端口占用时进程应以失败码退出。若失败：检查 server error handler 是否调用 process.exit(1)').toBe(
      1,
    );
    expect(
      output,
      '端口占用时应输出中文说明。若失败：检查 src/index.ts 的 EADDRINUSE 分支',
    ).toContain(`启动失败：端口 ${address.port} 已被占用`);
    expect(
      output,
      '端口占用时仍应保留原始 EADDRINUSE 堆栈。若失败：检查是否吞掉原始错误',
    ).toContain('EADDRINUSE');
  }, 15_000);
});
