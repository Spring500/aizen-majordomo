import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import type { Hono } from 'hono';
import type { AppEnv } from '../types.ts';

const distDir = join(process.cwd(), 'web', 'dist');

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function assetResponse(path: string) {
  const file = readFileSync(path);
  return new Response(file, {
    headers: {
      'content-type': contentTypes[extname(path)] ?? 'application/octet-stream',
    },
  });
}

function safeAssetPath(relative: string) {
  const normalized = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
  return join(distDir, 'assets', normalized);
}

export function mountStatic(app: Hono<AppEnv>) {
  app.get('/assets/*', (c) => {
    const relative = c.req.path.replace(/^\/assets\//, '');
    const path = safeAssetPath(relative);
    if (!existsSync(path) || !statSync(path).isFile()) return c.notFound();
    return assetResponse(path);
  });

  app.get('/', () => {
    const index = join(distDir, 'index.html');
    if (!existsSync(index)) {
      return new Response('前端尚未构建。请先运行 pnpm build:web。', { status: 404 });
    }
    return assetResponse(index);
  });
}
