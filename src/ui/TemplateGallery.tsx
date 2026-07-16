import { TEMPLATES } from '../templates';
import { useAssemblyStore } from '../store/assemblyStore';

/**
 * The piece that lets someone actually pick "what kind of automaton toy"
 * they want, instead of reading TypeScript - see templates/index.ts.
 */
export function TemplateGallery() {
  const templateId = useAssemblyStore((s) => s.templateId);
  const selectTemplate = useAssemblyStore((s) => s.selectTemplate);

  return (
    <div className="template-gallery">
      <h2>Choose an Automaton</h2>
      <div className="template-grid">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            className={`template-card ${template.id === templateId ? 'selected' : ''}`}
            onClick={() => selectTemplate(template.id)}
          >
            <span className="template-icon">{template.icon}</span>
            <span className="template-name">{template.name}</span>
            <span className="template-description">{template.description}</span>
            <span className="template-tags">
              {template.mechanisms.map((m) => (
                <span key={m} className="template-tag">
                  {m}
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
