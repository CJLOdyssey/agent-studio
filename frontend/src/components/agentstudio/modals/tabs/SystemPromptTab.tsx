import { forwardRef, type ForwardedRef } from 'react';
import { Plus } from 'lucide-react';

interface SystemPromptTabProps {
  value: string;
  onChange: (v: string) => void;
  onAddFromWorkstation: () => void;
}

export const SystemPromptTab = forwardRef(function SystemPromptTab(
  { value, onChange, onAddFromWorkstation }: SystemPromptTabProps,
  ref: ForwardedRef<HTMLTextAreaElement>,
) {
  return (
    <div className="form-group">
      <div className="agent-config-list-bar">
        <button className="agent-config-list-bar-btn" onClick={onAddFromWorkstation}>
          <Plus size={14} />
          添加
        </button>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="定义该 Agent 的角色、职责和行为规则..."
        className="form-textarea"
        rows={6}
      />
      <div className="agent-config-char-count">{value.length} 字符</div>
      <p className="form-hint">系统提示词定义了 Agent 的核心身份和行为准则</p>
    </div>
  );
});
