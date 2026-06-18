import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SidebarFilters } from '../../web/src/components/SidebarFilters.tsx';
import type { AppConfig } from '../../web/src/types.ts';

const reviewConfig: AppConfig = {
  cardTypes: [
    {
      id: 'review',
      name: 'Review',
      fields: [
        { id: 'case_subject', label: '核验主题', kind: 'text' },
        {
          id: 'audit_domain',
          label: '审查领域',
          kind: 'enum',
          options: [{ value: 'privacy', label: '隐私合规' }],
        },
        { id: 'needs_followup', label: '需要跟进', kind: 'boolean' },
        { id: 'investigation_notes', label: '调查记录全文', kind: 'longText' },
        { id: 'attachment_meta', label: '附件元数据', kind: 'json' },
      ],
      actions: [],
    },
  ],
  statuses: [{ id: 'triage', name: '分拣' }],
  transitions: [],
  hookActionModels: [],
  hooks: [],
};

describe('配置化筛选条件列表', () => {
  it('字段条件来自配置并显示字段类型和暂未支持标识', () => {
    const html = renderToStaticMarkup(
      <SidebarFilters
        filters={{ type: '', fields: { audit_domain: 'privacy' } }}
        counts={{ all: 1, review: 1 }}
        config={reviewConfig}
        open={true}
        onClose={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(html, '筛选面板不应继续写死负责人。若失败：检查 SidebarFilters 是否仍渲染 assignee 固定控件').not.toContain(
      '负责人',
    );
    expect(html, '筛选面板不应继续写死风险等级。若失败：检查 SidebarFilters 是否仍特殊处理 risk_level').not.toContain(
      '风险等级',
    );
    expect(html, '字段选择应展示配置字段及类型。若失败：检查字段候选是否来自 config.cardTypes.fields').toContain(
      '审查领域 · 枚举 enum',
    );
    expect(html, '未支持过滤语义的字段也应出现在候选中。若失败：检查是否错误隐藏 json 字段').toContain(
      '附件元数据 · JSON · 未支持筛选',
    );
    expect(html, '未支持字段应使用简洁状态文案。若失败：检查 unsupported field UI 是否仍使用长警告').toContain(
      '未支持筛选',
    );
    expect(html, '未支持字段不应使用导致换行难看的感叹号组合。若失败：检查字段类型标签文案').not.toContain(
      '! JSON 暂未支持',
    );
    expect(html, '未支持字段不应渲染大块说明文案。若失败：检查 unsupported note 是否仍占用条件行高度').not.toContain(
      '该字段类型已在配置中声明',
    );
    expect(html, '字段条件编辑应提供应用按钮。若失败：检查字段条件是否仍采用改值即关闭抽屉').toContain(
      '应用筛选',
    );
  });

  it('提供等待回复筛选入口', () => {
    const html = renderToStaticMarkup(
      <SidebarFilters
        filters={{ type: '', fields: {} }}
        counts={{ all: 1 }}
        config={reviewConfig}
        open={true}
        onClose={vi.fn()}
        onChange={vi.fn()}
      />,
    );

    expect(html, '筛选面板应提供等待回复入口。若失败：检查 SidebarFilters 是否包含阶段 3 快捷筛选').toContain(
      '等待回复',
    );
  });
});
