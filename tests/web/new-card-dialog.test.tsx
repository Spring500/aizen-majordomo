import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NewCardDialog } from '../../web/src/components/NewCardDialog.tsx';
import type { WorkspaceConfig } from '../../web/src/types.ts';

describe('阶段 2 配置驱动表单', () => {
  it('新建表单按传入配置渲染字段和状态，而不是写死样例字段', () => {
    const config: WorkspaceConfig = {
      cardTypes: [
        {
          id: 'review',
          name: 'Review',
          fields: [
            { id: 'title', label: '标题', kind: 'text', required: true },
            { id: 'review_code', label: '审核码', kind: 'text' },
            {
              id: 'risk_level',
              label: '风险等级',
              kind: 'enum',
              options: [{ value: 'high', label: '高' }],
            },
          ],
          actions: [
            {
              id: 'create',
              label: '创建',
              kind: 'create',
              writableFields: ['title', 'review_code'],
              requiredFields: ['title'],
            },
          ],
        },
      ],
      statuses: [{ id: 'triage', name: '分拣' }],
      transitions: [],
      hookActionModels: [],
      hooks: [],
    };

    const html = renderToStaticMarkup(
      <NewCardDialog open={true} config={config} onClose={() => undefined} onCreate={async () => undefined} />,
    );

    expect(html, '新建表单应渲染临时配置里的 Review 类型。若失败：检查类型下拉是否使用 props.config').toContain(
      'Review',
    );
    expect(html, '新建表单应渲染 create.writableFields 里的审核码。若失败：检查字段是否来自 action 配置').toContain(
      '审核码',
    );
    expect(html, '新建表单不应渲染未授权写入的风险等级。若失败：检查是否绕过 create action 写死字段').not.toContain(
      '风险等级',
    );
    expect(html, '新建表单应渲染传入配置里的状态名称。若失败：检查状态下拉是否使用 props.config.statuses').toContain(
      '分拣',
    );
  });
});
