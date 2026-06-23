import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { prepareScenarioRuntime, startScenarioServer } from '../helpers/scenario.ts';

const execFileAsync = promisify(execFile);
const skillDir = 'agent-kit/skills/majordomo';

describe('majordomo agent CLI', () => {
  it('ask 创建 waiting decision 并输出 card id 和等待命令', async () => {
    const runtime = await prepareScenarioRuntime('agent-board-config');
    const server = await startScenarioServer(runtime, { port: 0 });

    let result: { stdout: string };
    try {
      result = await execFileAsync('node', [
        'scripts/majordomo.mjs',
        'ask',
        '--base-url',
        server.url,
        '--title',
        '是否采用方案 A？',
        '--body',
        '请确认。',
        '--option',
        '采用 A',
        '--option',
        '采用 B',
      ], { cwd: skillDir });
    } finally {
      await server.close();
    }

    expect(result.stdout, 'ask 输出应明确说明已创建等待回复的 decision').toContain('已创建等待人类回复的 decision');
    expect(result.stdout, 'ask 输出应包含 card id 提示，便于 agent 复制后续命令').toContain('本次询问的 card id 是：');
    expect(result.stdout, 'ask 输出应包含 wait-reply 命令，便于 agent 直接继续等待').toContain(
      'node scripts/majordomo.mjs wait-reply --card-id',
    );
  });

  it('wait-reply 对已有回复的 decision 输出变更历史', async () => {
    const runtime = await prepareScenarioRuntime('agent-board-config');
    const server = await startScenarioServer(runtime, { port: 0 });
    const createRes = await fetch(`${server.url}/cards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ type: 'decision', status: 'waiting', fields: { title: '需要回复' } }),
    });
    const created = (await createRes.json()) as { card: { id: string } };
    await fetch(`${server.url}/cards/${created.card.id}/actions/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'human' },
      body: JSON.stringify({ fields: { reply: '选择 A' } }),
    });

    let result: { stdout: string };
    try {
      result = await execFileAsync('node', [
        'scripts/majordomo.mjs',
        'wait-reply',
        '--base-url',
        server.url,
        '--card-id',
        created.card.id,
      ], { cwd: skillDir });
    } finally {
      await server.close();
    }

    expect(
      result.stdout,
      'wait-reply 检测到变更时应输出变更历史提示。若失败：检查 waitReply 是否改为检测 changes',
    ).toContain('卡片有新的变更');
    expect(
      result.stdout,
      'wait-reply 应输出 card id。若失败：检查变更历史输出格式',
    ).toContain(created.card.id);
    expect(
      result.stdout,
      'wait-reply 应展示回复内容。若失败：检查 describeChange 对 transition 事件是否提取 reply',
    ).toContain('选择 A');
  });
});
