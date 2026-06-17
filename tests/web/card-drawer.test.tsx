import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CardDrawer } from '../../web/src/components/CardDrawer.tsx';
import type { AppConfig, Card } from '../../web/src/types.ts';

const config: AppConfig = {
  cardTypes: [
    {
      id: 'decision',
      name: 'Decision',
      fields: [
        { id: 'title', label: '标题', kind: 'text', required: true },
        { id: 'reply', label: '正式回复', kind: 'longText' },
        { id: 'replied_by', label: '回复人', kind: 'actor' },
      ],
      actions: [
        { id: 'update', label: '编辑', kind: 'update', writableFields: ['title'] },
        { id: 'reply', label: '正式回复', kind: 'reply', writableFields: ['reply', 'replied_by'], requiredFields: ['reply'] },
      ],
    },
  ],
  statuses: [],
  transitions: [],
  hookActionModels: [],
  hooks: [],
};

const card: Card = {
  id: 'decision-1',
  type: 'decision',
  status: 'waiting',
  fields: { title: '需要回复' },
  title: '需要回复',
  body: null,
  options: null,
  lane: null,
  priority: null,
  assignee: null,
  reply: null,
  replied_by: null,
  created_by: 'agent',
  created_at: 1,
  updated_at: 1,
};

describe('卡片详情正式回复区', () => {
  it('声明 reply action 的 decision 会显示正式回复输入区', () => {
    const html = renderToStaticMarkup(
      <CardDrawer
        card={card}
        config={config}
        open={true}
        onClose={vi.fn()}
        onSave={async () => undefined}
        onReply={async () => undefined}
      />,
    );

    expect(html, '详情抽屉应显示正式回复标题。若失败：检查 CardDrawer 是否识别 reply action').toContain('正式回复');
    expect(html, '未回复 decision 应显示提交回复按钮。若失败：检查回复输入区是否渲染').toContain('提交回复');
  });
});
