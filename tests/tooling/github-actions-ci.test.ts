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
  it('PR 和 main push 会运行完整测试门禁并记录关键步骤耗时', () => {
    const workflow = readCiWorkflow();

    expect(
      workflow,
      'CI 应在 PR 上触发。若失败：检查 pull_request 触发器是否缺失',
    ).toContain('pull_request:');
    expect(
      workflow,
      'CI 应在 main push 上触发。若失败：检查 main 合并后测试门禁是否缺失',
    ).toContain('branches:');
    expect(
      workflow,
      'CI 应通过计时脚本记录依赖安装耗时。若失败：检查 GitHub job summary 是否会缺少安装阶段记录',
    ).toContain(
      'node scripts/ci-step.mjs --name "Install dependencies" -- pnpm install --frozen-lockfile',
    );
    expect(
      workflow,
      'CI 应通过计时脚本记录 Vitest 耗时。若失败：检查 GitHub job summary 是否会缺少快速测试记录',
    ).toContain('node scripts/ci-step.mjs --name "Run Vitest" -- pnpm test');
    expect(
      workflow,
      'CI 应单独构建前端并记录耗时。若失败：检查构建耗时是否仍混在 Playwright 阶段里',
    ).toContain('node scripts/ci-step.mjs --name "Build web" -- pnpm build:web');
    expect(
      workflow,
      'CI 应单独安装 Playwright Chromium 并记录耗时。若失败：检查最大耗时阶段是否不可观察',
    ).toContain(
      'node scripts/ci-step.mjs --name "Install Playwright Chromium" -- pnpm exec playwright install --with-deps chromium',
    );
    expect(
      workflow,
      'CI 应通过计时脚本记录 Playwright e2e 耗时。若失败：检查 GitHub job summary 是否会缺少 e2e 记录',
    ).toContain(
      'node scripts/ci-step.mjs --name "Run Playwright" -- pnpm test:e2e',
    );
  });

  it('CI 计时脚本会写入 GitHub job summary', () => {
    const script = readFileSync(join(process.cwd(), 'scripts', 'ci-step.mjs'), 'utf8');

    expect(
      script,
      'CI 计时脚本应读取 GITHUB_STEP_SUMMARY。若失败：检查 Actions 页面是否能展示步骤摘要',
    ).toContain('GITHUB_STEP_SUMMARY');
    expect(
      script,
      'CI 计时脚本应记录成功状态。若失败：检查成功步骤摘要是否可读',
    ).toContain('success');
    expect(
      script,
      'CI 计时脚本应记录失败状态。若失败：检查失败步骤摘要是否可读',
    ).toContain('failure');
    expect(
      script,
      'CI 计时脚本应记录耗时。若失败：检查摘要是否能定位慢步骤',
    ).toContain('duration');
  });

  it('Playwright 启动服务不重复构建前端', () => {
    const config = readFileSync(join(process.cwd(), 'playwright.config.ts'), 'utf8');

    expect(
      config,
      '前端构建应由 CI 的 Build web 步骤单独计时。若失败：检查 Playwright 耗时是否混入重复构建',
    ).not.toContain('pnpm build:web &&');
    expect(
      config,
      'Playwright webServer 应只启动 E2E 服务。若失败：检查 E2E 服务启动命令是否被误删',
    ).toContain('scripts/e2e-server.ts');
  });

  it('PR 会校验提交消息范围', () => {
    const workflow = readWorkflow('commit-messages-pr.yml');

    expect(
      workflow,
      'PR 提交消息 workflow 应使用直观的展示名。若失败：检查 GitHub checks 是否会显示模糊名称',
    ).toContain('Validate commit message format');
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
      'main 提交消息 workflow 应使用直观的展示名。若失败：检查 GitHub checks 是否会显示模糊名称',
    ).toContain('Validate commit message format');
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
