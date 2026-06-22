import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceConfig, CardFilters, FieldDefinition, FieldKind } from '../types.ts';

const filterableKinds = new Set<FieldKind>(['text', 'number', 'boolean', 'stringList', 'enum', 'actor']);

const kindLabels: Record<FieldKind, string> = {
  text: '文本 text',
  longText: '长文本 longText',
  number: '数字 number',
  boolean: '布尔 boolean',
  stringList: '字符串列表 stringList',
  enum: '枚举 enum',
  actor: '参与者 actor',
  datetime: '日期 datetime',
  json: 'JSON',
};

function fieldOptionLabel(field: FieldDefinition): string {
  return `${field.label} · ${kindLabels[field.kind]}${filterableKinds.has(field.kind) ? '' : ' · 未支持筛选'}`;
}

function fieldValueInput(
  field: FieldDefinition,
  value: string,
  onValueChange: (value: string) => void,
) {
  if (!filterableKinds.has(field.kind)) {
    return <div className="disabled-value">未支持筛选</div>;
  }
  if (field.kind === 'enum') {
    return (
      <select aria-label={`筛选${field.label}的值`} value={value} onChange={(event) => onValueChange(event.target.value)}>
        <option value="">请选择</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.kind === 'boolean') {
    return (
      <select aria-label={`筛选${field.label}的值`} value={value} onChange={(event) => onValueChange(event.target.value)}>
        <option value="">请选择</option>
        <option value="true">是</option>
        <option value="false">否</option>
      </select>
    );
  }
  return (
    <input
      aria-label={`筛选${field.label}的值`}
      type={field.kind === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
    />
  );
}

export function SidebarFilters({
  filters,
  counts,
  config,
  open,
  onClose,
  onChange,
}: {
  filters: CardFilters;
  counts: Record<string, number>;
  config: WorkspaceConfig;
  open: boolean;
  onClose: () => void;
  onChange: (filters: CardFilters) => void;
}) {
  function updateFilters(next: CardFilters) {
    onChange(next);
    onClose();
  }
  const [draftFields, setDraftFields] = useState<Record<string, string>>(filters.fields ?? {});
  const enabledStatuses = config.statuses.filter((status) => status.enabled !== false);
  const fields = useMemo(() => {
    const sourceTypes = filters.type ? config.cardTypes.filter((item) => item.id === filters.type) : config.cardTypes;
    const byId = new Map<string, FieldDefinition>();
    for (const field of sourceTypes.flatMap((item) => item.fields)) {
      if (field.hidden || byId.has(field.id)) continue;
      byId.set(field.id, field);
    }
    return [...byId.values()];
  }, [config.cardTypes, filters.type]);

  useEffect(() => {
    setDraftFields(filters.fields ?? {});
  }, [filters.fields]);

  function updateConditionField(previousId: string, nextId: string) {
    setDraftFields((current) => {
      const next = { ...current };
      const value = next[previousId] ?? '';
      delete next[previousId];
      if (nextId) next[nextId] = value;
      return next;
    });
  }

  function updateConditionValue(fieldId: string, value: string) {
    setDraftFields((current) => ({ ...current, [fieldId]: value }));
  }

  function addCondition() {
    const field = fields.find((item) => !Object.hasOwn(draftFields, item.id));
    if (!field) return;
    setDraftFields((current) => ({ ...current, [field.id]: '' }));
  }

  function clearFieldFilters() {
    setDraftFields({});
    onChange({ ...filters, fields: {} });
  }

  function applyFieldFilters() {
    const nextFields = Object.fromEntries(
      Object.entries(draftFields).filter(([fieldId, value]) => {
        const field = fields.find((item) => item.id === fieldId);
        return field && filterableKinds.has(field.kind) && value !== '';
      }),
    );
    onChange({ ...filters, fields: nextFields });
    onClose();
  }

  const conditionEntries = Object.entries(draftFields);

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="筛选">
      <div className="sidebar-head mobile-only">
        <div>
          <h2>筛选</h2>
          <span>与宽屏左侧栏对位</span>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="关闭筛选">
          ×
        </button>
      </div>
      <section className="sidebar-section">
        <h2>类型</h2>
        <div className="filter-list">
          <button
            aria-label="全部卡片"
            className={`filter-item ${filters.type === '' ? 'active' : ''}`}
            type="button"
            onClick={() => updateFilters({ ...filters, type: '' })}
          >
            <span>全部卡片</span>
            <span className="count">{counts.all ?? 0}</span>
          </button>
          {config.cardTypes.map((item) => (
            <button
              aria-label={item.name}
              className={`filter-item ${filters.type === item.id ? 'active' : ''}`}
              key={item.id}
              type="button"
              onClick={() => updateFilters({ ...filters, type: item.id })}
            >
              <span>{item.name}</span>
              <span className="count">{counts[item.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="sidebar-section">
        <h2>字段条件</h2>
        <div className="condition-list">
          {conditionEntries.length === 0 && <p className="hint">未添加字段条件。</p>}
          {conditionEntries.map(([fieldId, value], index) => {
            const field = fields.find((item) => item.id === fieldId) ?? fields[0];
            if (!field) return null;
            const supported = filterableKinds.has(field.kind);
            return (
              <div className={`condition-row ${supported ? '' : 'unsupported'}`} key={`${fieldId}-${index}`}>
                <div className="condition-top">
                  <label className="field-picker">
                    <span className="field-picker-label">条件 {index + 1}</span>
                    <select
                      aria-label="选择筛选字段"
                      value={field.id}
                      onChange={(event) => updateConditionField(fieldId, event.target.value)}
                    >
                      {fields.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {fieldOptionLabel(candidate)}
                        </option>
                      ))}
                    </select>
                    <span className="field-meta">
                      <span className="field-kind">{kindLabels[field.kind]}</span>
                      {!supported && <span className="unsupported-mark">未支持筛选</span>}
                    </span>
                  </label>
                  <button
                    className="remove"
                    type="button"
                    aria-label="移除条件"
                    onClick={() =>
                      setDraftFields((current) => {
                        const next = { ...current };
                        delete next[fieldId];
                        return next;
                      })
                    }
                  >
                    ×
                  </button>
                </div>
                <div className="condition-controls">
                  <select aria-label="选择筛选操作符" disabled={!supported}>
                    <option>{supported ? (field.kind === 'stringList' ? '包含' : '等于') : '未支持'}</option>
                  </select>
                  {fieldValueInput(field, value, (nextValue) => updateConditionValue(field.id, nextValue))}
                </div>
              </div>
            );
          })}
        </div>
        <button className="add-condition" type="button" onClick={addCondition}>
          添加筛选条件
        </button>
        <p className="hint">字段来自当前配置；未支持类型可见，但不会提交为有效条件。</p>
      </section>
      <section className="sidebar-section">
        <h2>状态</h2>
        <div className="filter-list">
          <button
            aria-label="全部状态"
            className={`filter-item ${!filters.status ? 'active' : ''}`}
            type="button"
            onClick={() => updateFilters({ ...filters, status: undefined })}
          >
            <span>全部状态</span>
          </button>
          {enabledStatuses.map((status) => (
            <button
              aria-label={status.name}
              className={`filter-item ${filters.status === status.id ? 'active' : ''}`}
              key={status.id}
              type="button"
              onClick={() => updateFilters({ ...filters, status: status.id })}
            >
              <span>{status.name}</span>
            </button>
          ))}
        </div>
      </section>
      <div className="sidebar-actions">
        <button className="button" type="button" onClick={clearFieldFilters}>
          清空
        </button>
        <button className="button primary" type="button" onClick={applyFieldFilters}>
          应用筛选
        </button>
      </div>
    </aside>
  );
}
