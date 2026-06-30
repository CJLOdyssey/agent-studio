import { useState, useEffect } from 'react';
import { Wand2, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react';
import {
  generateTool,
  generateToolWithLlm,
  checkLlmStatus,
  validateTool,
  type GeneratedTool,
} from '../../../api/client/tools';

interface Props {
  onAdd: (tool: { id: string; name: string; description: string; enabled: boolean }) => void;
  onClose: () => void;
}

export default function ToolGenerator({ onAdd, onClose }: Props) {
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState<'python' | 'javascript'>('python');
  const [generatedTool, setGeneratedTool] = useState<GeneratedTool | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ is_valid: boolean; suggestions: string[] } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState(false);

  useEffect(() => {
    checkLlmStatus()
      .then((res) => setLlmAvailable(res.available))
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedTool(null);
    setValidationResult(null);

    try {
      const tool = llmAvailable
        ? await generateToolWithLlm(description, language)
        : await generateTool(description, language);
      setGeneratedTool(tool);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleValidate = async () => {
    if (!generatedTool) return;
    setIsValidating(true);
    try {
      const result = await validateTool(generatedTool.code, language);
      setValidationResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证失败');
    } finally {
      setIsValidating(false);
    }
  };

  const handleAdd = () => {
    if (!generatedTool) return;
    onAdd({
      id: generatedTool.id,
      name: generatedTool.name,
      description: generatedTool.description,
      enabled: true,
    });
    onClose();
  };

  const handleCopy = () => {
    if (!generatedTool) return;
    navigator.clipboard.writeText(generatedTool.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="tool-generator">
      <div className="tool-generator-header">
        <Wand2 size={16} />
        <span>生成工具</span>
        <span className={`tool-generator-llm-status ${llmAvailable ? 'active' : ''}`}>
          {llmAvailable ? 'LLM 已连接' : 'LLM 未配置'}
        </span>
      </div>

      <div className="tool-generator-input">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            llmAvailable
              ? '描述你想要的工具，例如：发送邮件通知、生成PDF报告'
              : '描述你想要的工具，例如：查询天气、读取文件'
          }
          rows={3}
          className="tool-generator-textarea"
        />
        <div className="tool-generator-options">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'python' | 'javascript')}
            className="tool-generator-select"
          >
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
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
        <div className="tool-generator-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {generatedTool && (
        <div className="tool-generator-result">
          <div className="tool-generator-result-header">
            <span className="tool-generator-name">{generatedTool.name}</span>
            <span className="tool-generator-desc">{generatedTool.description}</span>
          </div>

          <div className="tool-generator-code">
            <div className="tool-generator-code-header">
              <span>{language === 'python' ? 'Python' : 'JavaScript'}</span>
              <button onClick={handleCopy} className="tool-generator-copy">
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <pre>
              <code>{generatedTool.code}</code>
            </pre>
          </div>

          <div className="tool-generator-params">
            <span>参数：</span>
            {Object.entries(generatedTool.parameters).map(([key, param]) => (
              <span key={key} className="tool-generator-param">
                {key} ({param.type}
                {param.required ? ', 必填' : ''})
              </span>
            ))}
          </div>

          <div className="tool-generator-actions">
            <button onClick={handleValidate} disabled={isValidating} className="btn btn-secondary btn-sm">
              {isValidating ? '验证中...' : '验证代码'}
            </button>
            <button onClick={handleAdd} className="btn btn-primary btn-sm">
              添加到工具列表
            </button>
          </div>

          {validationResult && (
            <div className={`tool-generator-validation ${validationResult.is_valid ? 'valid' : 'invalid'}`}>
              {validationResult.is_valid ? (
                <>
                  <CheckCircle size={14} /> <span>代码验证通过</span>
                </>
              ) : (
                <>
                  <AlertCircle size={14} /> <span>需要优化</span>
                </>
              )}
              {validationResult.suggestions.length > 0 && (
                <ul className="tool-generator-suggestions">
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
