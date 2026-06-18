import { defineConfig } from 'vitest/config';
import { testRunEnv } from './tests/helpers/test-runtime.ts';

const env = testRunEnv('vitest');
Object.assign(process.env, env);

export default defineConfig({
  test: {
    env,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // 用 fork(子进程)池:对 node:sqlite 这类原生/实验模块比线程更稳。
    // 注:Node 22 加载 node:sqlite 会打印一行 ExperimentalWarning,属正常现象。
    pool: 'forks',
  },
});
