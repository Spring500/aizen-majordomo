import type { FieldDefinition } from '../types.ts';

export function getFieldValue(fields: Record<string, unknown>, field: FieldDefinition) {
  const value = fields[field.id];
  if (field.kind === 'stringList') return Array.isArray(value) ? value.join('\n') : '';
  if (field.kind === 'boolean') return Boolean(value);
  return value === undefined || value === null ? '' : String(value);
}

export function setFieldValue(field: FieldDefinition, value: string | boolean) {
  if (value === '') return null;
  if (field.kind === 'number') return Number(value);
  if (field.kind === 'boolean') return Boolean(value);
  if (field.kind === 'stringList') {
    return String(value)
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
}

export function DynamicFieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.hidden) return null;
  if (field.kind === 'longText' || field.kind === 'stringList') {
    return (
      <label className="field">
        <span>{field.label}</span>
        <textarea
          aria-label={field.label}
          value={getFieldValue({ [field.id]: value }, field) as string}
          onChange={(event) => onChange(setFieldValue(field, event.target.value))}
        />
      </label>
    );
  }
  if (field.kind === 'enum') {
    return (
      <label className="field">
        <span>{field.label}</span>
        <select
          aria-label={field.label}
          value={getFieldValue({ [field.id]: value }, field) as string}
          onChange={(event) => onChange(setFieldValue(field, event.target.value))}
        >
          <option value="">未设置</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.kind === 'boolean') {
    return (
      <label className="field checkbox-field">
        <span>{field.label}</span>
        <input
          aria-label={field.label}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(setFieldValue(field, event.target.checked))}
        />
      </label>
    );
  }
  return (
    <label className="field">
      <span>{field.label}</span>
      <input
        aria-label={field.label}
        type={field.kind === 'number' ? 'number' : 'text'}
        value={getFieldValue({ [field.id]: value }, field) as string}
        onChange={(event) => onChange(setFieldValue(field, event.target.value))}
      />
    </label>
  );
}
