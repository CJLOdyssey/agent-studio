import { useState } from 'react';
import { Sparkles, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react';
import { generateSkill, validateSkill, type GeneratedSkill } from '../../../api/client/skills';

interface Props {
  onAdd: (skill: { id: string; name: string; description: string; enabled: boolean }) => void;
  onClose: () => void;
}

const CATEGORIES = [
  { value: 'general', label: '通用' },
  { value: 'code-quality', label: '代码质量' },
  { value: 'security', label: '安全' },
  { value: 'architecture', label: '架构' },
  { value: 'performance', label: '性能' },
  { value: 'workflow', label: '工作流' },
  { value: 'documentation', label: '文档' },
  { value: 'devops', label: '运维' },
];

export default function SkillGenerator({ onAdd, onClose }: Props) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [generatedSkill, setGeneratedSkill] = useState<GeneratedSkill | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ is_valid: boolean; suggestions: string[] } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedSkill(null);
    setValidationResult(null);

    try {
      const skill = await generateSkill(description, category);
      setGeneratedSkill(skill);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleValidate = async () => {
    if (!generatedSkill) return;
    setIsValidating(true);
    try {
      const result = await validateSkill(generatedSkill.content);
      setValidationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setIsValidating(false);
    }
  };

  const handleAdd = () => {
    if (!generatedSkill) return;
    onAdd({
      id: generatedSkill.id,
      name: generatedSkill.name,
      description: generatedSkill.description,
      enabled: true,
    });
    onClose();
  };

  const handleCopy = () => {
    if (!generatedSkill) return;
    navigator.clipboard.writeText(generatedSkill.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="skill-generator">
      <div className="skill-generator-header">
        <Sparkles size={16} />
        <span>生成 Skill</span>
      </div>

      <div className="skill-generator-input">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述你想要的 Skill，例如：代码审查规范、API 设计最佳实践、数据库设计规范..."
          rows={3}
          className="skill-generator-textarea"
        />
        <div className="skill-generator-options">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="skill-generator-select"
          >
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
            className="btn btn-primary btn-sm"
          >
            {isGenerating ? '生成中...' : '生成'}
          </button>
        </div>
      </div>

      {error && (
        <div className="skill-generator-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {generatedSkill && (
        <div className="skill-generator-result">
          <div className="skill-generator-result-header">
            <span className="skill-generator-name">{generatedSkill.name}</span>
            <span className="skill-generator-desc">{generatedSkill.description}</span>
          </div>

          <div className="skill-generator-preview">
            <div className="skill-generator-preview-header">
              <span>SKILL.md</span>
              <button onClick={handleCopy} className="skill-generator-copy">
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <pre><code>{generatedSkill.content}</code></pre>
          </div>

          <div className="skill-generator-meta">
            <span className="skill-generator-category">类别: {generatedSkill.category}</span>
          </div>

          <div className="skill-generator-actions">
            <button onClick={handleValidate} disabled={isValidating} className="btn btn-secondary btn-sm">
              {isValidating ? '验证中...' : '验证格式'}
            </button>
            <button onClick={handleAdd} className="btn btn-primary btn-sm">
              添加到 Skills 列表
            </button>
          </div>

          {validationResult && (
            <div className={`skill-generator-validation ${validationResult.is_valid ? 'valid' : 'invalid'}`}>
              {validationResult.is_valid ? (
                <><CheckCircle size={14} /> <span>SKILL.md 格式正确</span></>
              ) : (
                <><AlertCircle size={14} /> <span>需要优化</span></>
              )}
              {validationResult.suggestions.length > 0 && (
                <ul className="skill-generator-suggestions">
                  {validationResult.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
