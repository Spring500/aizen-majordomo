import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { testRunEnv } from '../tests/helpers/test-runtime.ts';

// Command wrapper for `pnpm test:e2e`.
// It prepares per-run process environment, then delegates to Playwright.
// Runs Playwright with one stable, dynamically allocated port for this command.
// Playwright evaluates its config in more than one process; allocating the port
// here and passing it through env keeps webServer.url and test baseURL aligned.
async function findAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('无法获取 Playwright E2E 临时端口')));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

const port = await findAvailablePort();
const playwrightBin = join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.CMD' : 'playwright');
const child = spawn(playwrightBin, ['test', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: {
    ...testRunEnv('playwright'),
    PORT: String(port),
  },
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
