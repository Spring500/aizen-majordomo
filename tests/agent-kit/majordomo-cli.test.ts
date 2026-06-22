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

  it('wait-reply 对已有回复的 decision 立即输出回复内容', async () => {
    const runtime = await prepareScenarioRuntime('agent-board-config');
    const server = await startScenarioServer(runtime, { port: 0 });
    const createRes = await fetch(`${server.url}/cards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ type: 'decision', fields: { title: '需要回复' } }),
    });
    const created = (await createRes.json()) as { card: { id: string } };
    await fetch(`${server.url}/cards/${created.card.id}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Actor': 'agent' },
      body: JSON.stringify({ transitionId: 'request_reply' }),
    });
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

    expect(result.stdout, 'wait-reply 对已有回复应输出已收到提示').toContain('已收到人类回复');
    expect(result.stdout, 'wait-reply 应输出回复人').toContain('回复人：human');
    expect(result.stdout, 'wait-reply 应输出回复内容').toContain('选择 A');
  });
});
