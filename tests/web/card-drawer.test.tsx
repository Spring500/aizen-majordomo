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
      ],
      actions: [
        { id: 'update', label: '编辑', kind: 'update', writableFields: ['title'] },
        { id: 'reply', label: '正式回复', kind: 'reply', writableFields: ['reply'], requiredFields: ['reply'] },
      ],
    },
  ],
  statuses: [{ id: 'waiting', name: '等待回复' }],
  transitions: [
    {
      id: 'submit_reply',
      name: '提交回复',
      cardType: 'decision',
      fromStatus: 'waiting',
      toStatus: 'resolved',
      writableFields: ['reply'],
      requiredFields: ['reply'],
    },
  ],
  hookActionModels: [],
  hooks: [],
};

const card: Card = {
  id: 'decision-1',
  type: 'decision',
  status: 'waiting',
  fields: { title: '需要回复' },
  created_by: 'agent',
  created_at: 1,
  updated_at: 1,
};

describe('卡片详情正式回复区', () => {
  it('waiting decision 会通过 submit_reply transition 显示正式回复入口', () => {
    const html = renderToStaticMarkup(
      <CardDrawer
        card={card}
        config={config}
        open={true}
        onClose={vi.fn()}
        onSave={async () => undefined}
        onTransition={async () => undefined}
      />,
    );

    expect(html, 'submit_reply transition 应渲染正式回复字段。若失败：检查 CardDrawer 是否按 transition.writableFields 渲染').toContain(
      '正式回复',
    );
    expect(html, 'submit_reply transition 应显示提交回复按钮。若失败：检查 transition.name 是否作为按钮文案').toContain(
      '提交回复',
    );
  });

  it('详情状态使用配置显示名而不是原始状态 id', () => {
    const html = renderToStaticMarkup(
      <CardDrawer
        card={card}
        config={{ ...config, statuses: [{ id: 'waiting', name: '等待回复' }] }}
        open={true}
        onClose={vi.fn()}
        onSave={async () => undefined}
        onTransition={async () => undefined}
      />,
    );

    expect(html, '详情状态应显示配置中的中文状态名。若失败：检查 CardDrawer 是否把 status id 映射到 config.statuses.name').toContain(
      'value="等待回复"',
    );
    expect(html, '详情状态不应直接显示原始 waiting id。若失败：检查 Status input 的 value 是否仍使用 card.status').not.toContain(
      'value="waiting"',
    );
  });
});
