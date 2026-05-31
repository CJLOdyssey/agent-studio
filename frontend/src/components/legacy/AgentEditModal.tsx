import { useState, useEffect, useRef } from 'react';
import type { AgentConfig } from '../../types';

const ICON_OPTIONS = ['✦', '⚙', '⚗', '◆', '●', '▣', '▦', '◈', '◉', '◎', '◇', '□'];

interface Props {
  agent: AgentConfig | null;
  allAgents: AgentConfig[];
  onSave: (data: {
    name: string;
    role_identifier: string;
    system_prompt: string;
    order: number;
    is_active: boolean;
    is_approver: boolean;
    icon: string;
    model: string | null;
    temperature: number | null;
  }) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export default function AgentEditModal({ agent, allAgents, onSave, onDelete, onClose }: Props) {
  const isNew = agent === null;
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (modal) {
      const firstInput = modal.querySelector<HTMLElement>('input, button, textarea, select, [tabindex]:not([tabindex="-1"])');
      firstInput?.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>('input, button, textarea, select, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus();
    };
  }, [onClose]);
  const [name, setName] = useState(agent?.name ?? '');
  const [roleIdentifier, setRoleIdentifier] = useState(agent?.role_identifier ?? '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? '');
  const [order, setOrder] = useState(agent?.order ?? allAgents.length);
  const [isActive, setIsActive] = useState(agent?.is_active ?? true);
  const [isApprover, setIsApprover] = useState(agent?.is_approver ?? false);
  const [icon, setIcon] = useState(agent?.icon ?? '◆');
  const [model, setModel] = useState(agent?.model ?? '');
  const [temperature, setTemperature] = useState(agent?.temperature ?? 0.7);
  const [useCustomModel, setUseCustomModel] = useState(!!agent?.model);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const handleSave = () => {
    if (!name.trim() || !roleIdentifier.trim() || !systemPrompt.trim()) return;
    onSave({
      name: name.trim(),
      role_identifier: roleIdentifier.trim().toLowerCase().replace(/\s+/g, '_'),
      system_prompt: systemPrompt.trim(),
      order,
      is_active: isActive,
      is_approver: isApprover,
      icon,
      model: useCustomModel && model ? model : null,
      temperature: useCustomModel ? temperature : null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content agent-modal" onClick={(e) => e.stopPropagation()} ref={modalRef} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>{isNew ? '添加团队成员' : '编辑团队成员'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <div className="form-group form-group-half">
              <label>名称</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：前端工程师"
                className="form-input"
              />
            </div>
            <div className="form-group form-group-half">
              <label>角色标识</label>
              <input
                type="text"
                value={roleIdentifier}
                onChange={(e) => setRoleIdentifier(e.target.value)}
                placeholder="如：frontend"
                className="form-input"
                disabled={!isNew}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group form-group-half">
              <label>表情图标</label>
              <div className="icon-picker-trigger" onClick={() => setShowIconPicker(!showIconPicker)}>
                <span className="icon-picker-icon">{icon}</span>
                <span className="icon-picker-arrow">▼</span>
              </div>
              {showIconPicker && (
                <div className="icon-picker-dropdown">
                  {ICON_OPTIONS.map((ic) => (
                    <button
                      key={ic}
                      className={`icon-option ${ic === icon ? 'selected' : ''}`}
                      onClick={() => { setIcon(ic); setShowIconPicker(false); }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group form-group-half">
              <label>发言顺序</label>
              <input
                type="number"
                value={order}
                onChange={(e) => setOrder(Math.max(0, parseInt(e.target.value) || 0))}
                className="form-input"
                min={0}
              />
            </div>
          </div>

          <div className="form-group">
            <label>系统提示词</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="定义该 agent 的角色、职责和行为..."
              className="form-textarea"
              rows={6}
            />
          </div>

          <div className="form-row">
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span>活跃（参与讨论）</span>
              </label>
            </div>
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isApprover}
                  onChange={(e) => setIsApprover(e.target.checked)}
                />
                <span>审批者（拥有批准权）</span>
              </label>
            </div>
          </div>

          <div className="form-section-divider">模型配置（可选）</div>

          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={useCustomModel}
                onChange={(e) => setUseCustomModel(e.target.checked)}
              />
              <span>独立模型配置（不勾选则使用全局默认模型）</span>
            </label>
          </div>

          {useCustomModel && (
            <div className="form-row">
              <div className="form-group form-group-2x">
                <label>模型名称</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="如：deepseek-v4-flash"
                  className="form-input"
                />
              </div>
              <div className="form-group form-group-half">
                <label>Temperature</label>
                <input
                  type="number"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
                  className="form-input"
                  min={0}
                  max={1}
                  step={0.1}
                />
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!isNew && (
            <button
              className="btn btn-danger"
              onClick={() => onDelete(agent!.id)}
            >
              删除
            </button>
          )}
          <div className="modal-footer-spacer" />
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!name.trim() || !roleIdentifier.trim() || !systemPrompt.trim()}
          >
            {isNew ? '添加' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
