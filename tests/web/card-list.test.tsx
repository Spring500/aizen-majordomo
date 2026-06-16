import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CardList } from '../../web/src/components/CardList.tsx';
import type { AppConfig, Card } from '../../web/src/types.ts';

const config: AppConfig = {
  cardTypes: [
    {
      id: 'review',
      name: 'Review',
      fields: [
        { id: 'case_subject', label: '核验主题', kind: 'text' },
        { id: 'audit_domain', label: '审查领域', kind: 'enum', options: [{ value: 'privacy', label: '隐私合规' }] },
      ],
      actions: [],
    },
  ],
  statuses: [],
  transitions: [],
  hookActionModels: [],
  hooks: [],
};

const card: Card = {
  id: 'review-1',
  type: 'review',
  status: 'triage',
  fields: { case_subject: '第三方数据导出核验', audit_domain: 'privacy' },
  title: null,
  body: null,
  options: null,
  lane: null,
  priority: null,
  assignee: null,
  reply: null,
  replied_by: null,
  created_by: 'scenario',
  created_at: 1,
  updated_at: 1,
};

describe('配置化卡片列表展示', () => {
  it('无 title/priority 的卡片使用配置字段作为列表主信息', () => {
    const html = renderToStaticMarkup(
      <CardList cards={[card]} config={config} loading={false} onSelect={vi.fn()} />,
    );

    expect(html, '列表主标题应 fallback 到配置里的第一个 text 字段。若失败：检查 CardList 是否仍硬依赖 title').toContain(
      '第三方数据导出核验',
    );
    expect(html, '列表副信息应展示可读配置字段值。若失败：检查 CardList 是否仍硬依赖 body').toContain('隐私合规');
    expect(html, '无 priority 字段的业务不应显示 P0。若失败：检查 CardList 是否仍硬编码 priority').not.toContain('P0');
    expect(html, '无 assignee 字段的业务不应显示未分配。若失败：检查 CardList 是否仍硬编码 assignee').not.toContain(
      '未分配',
    );
  });
});
