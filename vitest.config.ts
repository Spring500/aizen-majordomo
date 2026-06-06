import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // 用 fork(子进程)池:对 node:sqlite 这类原生/实验模块比线程更稳。
    // 注:Node 22 加载 node:sqlite 会打印一行 ExperimentalWarning,属正常现象。
    pool: 'forks',
  },
});
