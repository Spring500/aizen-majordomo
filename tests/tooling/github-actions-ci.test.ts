import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readCiWorkflow() {
  return readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8');
}

describe('GitHub Actions CI 门禁', () => {
  it('PR 会校验提交消息范围和完整测试门禁', () => {
    const workflow = readCiWorkflow();

    expect(
      workflow,
      'CI 应在 PR 上触发。若失败：检查 pull_request 触发器是否缺失',
    ).toContain('pull_request:');
    expect(
      workflow,
      'CI 应校验 PR base..head 的提交消息范围。若失败：检查 commit message range 门禁是否缺失',
    ).toContain('github.event.pull_request.base.sha');
    expect(
      workflow,
      'CI 应校验 PR head sha。若失败：检查 range 是否只校验了单点而不是完整合入范围',
    ).toContain('github.event.pull_request.head.sha');
    expect(workflow, 'CI 应运行快速 Vitest。若失败：检查 test job 是否缺少 pnpm test').toContain(
      'pnpm test',
    );
    expect(workflow, 'CI 应运行 Playwright e2e。若失败：检查 test job 是否缺少 pnpm test:e2e').toContain(
      'pnpm test:e2e',
    );
  });
});
