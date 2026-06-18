import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('CI 步骤计时脚本', () => {
  it('耗时统一用保留一位小数的秒展示', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aizen-ci-step-'));
    const timingsFile = join(dir, 'timings.md');

    try {
      const result = spawnSync(
        process.execPath,
        ['scripts/ci-step.mjs', '--name', 'Local Check', '--', 'node', '-e', 'process.exit(0)'],
        {
          cwd: process.cwd(),
          env: { ...process.env, CI_STEP_TIMINGS_FILE: timingsFile },
          encoding: 'utf8',
        },
      );

      expect(
        result.status,
        `计时脚本应透传成功命令的退出码。若失败：检查 stderr=${result.stderr}`,
      ).toBe(0);

      const summary = readFileSync(timingsFile, 'utf8');

      expect(
        summary,
        '计时摘要应统一使用秒且保留一位小数。若失败：检查耗时格式是否仍混用 ms/s',
      ).toMatch(/\| Local Check \| PASS success \| \d+\.\ds \|/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
