import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readHook(name: string) {
  return readFileSync(join(process.cwd(), '.husky', name), 'utf8');
}

describe('main 合并门禁 hook 时机', () => {
  it('pre-merge-commit 用 GITHEAD 推导合入范围而不是解析 MERGE_HEAD', () => {
    const hook = readHook('pre-merge-commit');

    expect(
      hook,
      'pre-merge-commit 执行时 MERGE_HEAD 在当前 Git 行为下尚不可解析。若失败：检查 range 校验是否仍放在过早的 hook 中',
    ).not.toContain('node scripts/verify-range-messages.mjs "HEAD..MERGE_HEAD" || exit 1');
    expect(
      hook,
      'pre-merge-commit 应从 Git 提供的 GITHEAD_* 环境变量取得合入提交。若失败：检查一步式 no-ff 合并是否仍能校验范围',
    ).toContain('GITHEAD_');
    expect(
      hook,
      'pre-merge-commit 应用 HEAD..<合入提交> 校验范围。若失败：检查合入历史消息合规门禁是否缺失',
    ).toContain('HEAD..$merge_head');
    expect(
      hook,
      'pre-merge-commit 应调用范围消息校验脚本。若失败：检查合入历史消息合规门禁是否缺失',
    ).toContain('verify-range-messages');
  });

  it('pre-commit 不承担 no-ff 合入范围校验', () => {
    const hook = readHook('pre-commit');

    expect(
      hook,
      'no-ff 一步式合并的范围校验应在 pre-merge-commit 完成。若失败：检查是否把门禁拆成了两步式流程',
    ).not.toContain('HEAD..MERGE_HEAD');
  });
});
