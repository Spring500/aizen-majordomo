import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readCiWorkflow() {
  return readFileSync(join(process.cwd(), '.github', 'workflows', 'ci.yml'), 'utf8');
}

function readWorkflow(name: string) {
  return readFileSync(join(process.cwd(), '.github', 'workflows', name), 'utf8');
}

describe('GitHub Actions CI 门禁', () => {
  it('PR 和 main push 会运行完整测试门禁', () => {
    const workflow = readCiWorkflow();

    expect(
      workflow,
      'CI 应在 PR 上触发。若失败：检查 pull_request 触发器是否缺失',
    ).toContain('pull_request:');
    expect(
      workflow,
      'CI 应在 main push 上触发。若失败：检查 main 合并后测试门禁是否缺失',
    ).toContain('branches:');
    expect(workflow, 'CI 应运行快速 Vitest。若失败：检查 test job 是否缺少 pnpm test').toContain(
      'pnpm test',
    );
    expect(workflow, 'CI 应运行 Playwright e2e。若失败：检查 test job 是否缺少 pnpm test:e2e').toContain(
      'pnpm test:e2e',
    );
  });

  it('PR 会校验提交消息范围', () => {
    const workflow = readWorkflow('commit-messages-pr.yml');

    expect(
      workflow,
      'PR 提交消息 workflow 只应在 PR 上触发。若失败：检查是否会在 push 事件产生 skipped 噪音',
    ).toContain('pull_request:');
    expect(
      workflow,
      'PR 提交消息 workflow 不应监听 push。若失败：检查是否会在 main push 事件产生 skipped 噪音',
    ).not.toContain('push:');
    expect(
      workflow,
      'CI 应校验 PR base..head 的提交消息范围。若失败：检查 commit message range 门禁是否缺失',
    ).toContain('github.event.pull_request.base.sha');
    expect(
      workflow,
      'CI 应校验 PR head sha。若失败：检查 range 是否只校验了单点而不是完整合入范围',
    ).toContain('github.event.pull_request.head.sha');
  });

  it('main push 会校验合并后的提交消息范围', () => {
    const workflow = readWorkflow('commit-messages-main.yml');

    expect(
      workflow,
      'main 提交消息 workflow 应在 push 上触发。若失败：检查合并后提交消息门禁是否缺失',
    ).toContain('push:');
    expect(
      workflow,
      'main 提交消息 workflow 应只监听 main 分支。若失败：检查是否会在普通分支 push 上制造噪音',
    ).toContain('main');
    expect(
      workflow,
      'main 提交消息 workflow 不应监听 PR。若失败：检查是否会在 PR 事件产生 skipped 噪音',
    ).not.toContain('pull_request:');
    expect(
      workflow,
      'main push 应校验本次推送前后范围。若失败：检查合并后的 squash/merge commit message 是否会漏检',
    ).toContain('github.event.before');
    expect(
      workflow,
      'main push 应校验到当前提交。若失败：检查 main 最新提交是否会漏检',
    ).toContain('github.sha');
  });
});
