import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runPrMessageCheck(title: string, body: string) {
  return spawnSync(process.execPath, ['scripts/verify-pr-message.mjs'], {
    cwd: process.cwd(),
    env: { ...process.env, PR_TITLE: title, PR_BODY: body },
    encoding: 'utf8',
  });
}

describe('PR 描述提交消息校验', () => {
  it('PR title 和 body 拼出的 squash message 合规时通过', () => {
    const result = runPrMessageCheck(
      '构建: 记录 CI 步骤耗时',
      ['意图：让 PR 默认 squash message 满足提交规范。', '', '主要修改：', '- 校验 PR 标题和描述'].join('\n'),
    );

    expect(
      result.status,
      `合规 PR 描述应通过。若失败：检查 stderr=${result.stderr}`,
    ).toBe(0);
  });

  it('PR body 使用普通说明模板而不是提交正文格式时拒绝', () => {
    const result = runPrMessageCheck(
      '构建: 记录 CI 步骤耗时',
      ['## Summary', '- 拆分 CI 步骤', '', '## Test Plan', '- pnpm test'].join('\n'),
    );

    expect(
      result.status,
      '不含「意图」和「主要修改」正文的 PR 描述应被拒绝。若失败：检查 PR 描述是否无法约束最终 squash message',
    ).toBe(1);
    expect(
      result.stderr,
      '失败提示应指向 PR 描述和最终 squash message。若失败：检查开发者是否能理解要修改 PR body',
    ).toContain('PR title/body 拼出的 squash commit message 不合规');
  });
});
