import { getTemplate } from '../templates';
import type { TemplateParamField } from '../templates/types';
import { useAssemblyStore } from '../store/assemblyStore';

export function TemplateParamsPanel() {
  const templateId = useAssemblyStore((s) => s.templateId);
  const params = useAssemblyStore((s) => s.params);
  const updateParam = useAssemblyStore((s) => s.updateParam);
  const template = getTemplate(templateId);

  return (
    <div className="template-params-panel">
      <h2>Customize</h2>
      {template.paramSchema.map((field) => (
        <ParamField key={field.key} field={field} value={params[field.key]} onChange={(v) => updateParam(field.key, v)} />
      ))}
    </div>
  );
}

function ParamField({
  field,
  value,
  onChange,
}: {
  field: TemplateParamField;
  value: number | string;
  onChange: (value: number | string) => void;
}) {
  if (field.kind === 'number') {
    const numValue = typeof value === 'number' ? value : field.default;
    return (
      <label className="control-row">
        <span>
          {field.label}: {numValue}
          {field.unit ? field.unit : ''}
        </span>
        <input
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={numValue}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </label>
    );
  }

  if (field.kind === 'select') {
    const strValue = typeof value === 'string' ? value : field.default;
    return (
      <label className="control-row">
        <span>{field.label}</span>
        <select value={strValue} onChange={(e) => onChange(e.target.value)}>
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const colorValue = typeof value === 'string' ? value : field.default;
  return (
    <label className="control-row control-row-color">
      <span>{field.label}</span>
      <input type="color" value={colorValue} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
