import { useState, useEffect, useRef } from 'react';
import { X, Wrench, Server, Sparkles, Wand2 } from 'lucide-react';
import type { Agent, AgentTool, AgentMCP, AgentSkill } from '../../../types/devagents';
import { useTranslation } from 'react-i18next';
import { useItemList } from '../../../hooks/useItemList';
import ConfigItemList from './ConfigItemList';
import ToolGenerator from './ToolGenerator';
import SkillGenerator from './SkillGenerator';

interface Props {
  agent: Agent;
  onSave: (agent: Agent) => void;
  onClose: () => void;
}

const PRESET_TOOLS: Omit<AgentTool, 'enabled'>[] = [];
const PRESET_MCP: Omit<AgentMCP, 'enabled'>[] = [];
const PRESET_SKILLS: Omit<AgentSkill, 'enabled'>[] = [];

export default function AgentConfigModal({ agent, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement;
    const modal = modalRef.current;
    if (modal) {
      const firstInput = modal.querySelector<HTMLElement>(
        'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      firstInput?.focus();
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modal) return;
      const focusable = modal.querySelectorAll<HTMLElement>(
        'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus();
    };
  }, [onClose]);
  const tools = useItemList<AgentTool>(PRESET_TOOLS.map((t) => ({ ...t, enabled: false })));
  const mcp = useItemList<AgentMCP>(PRESET_MCP.map((t) => ({ ...t, enabled: false })));
  const skills = useItemList<AgentSkill>(PRESET_SKILLS.map((t) => ({ ...t, enabled: false })));

  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');
  const [outputConstraints, setOutputConstraints] = useState(agent.outputConstraints || '');
  const [activeTab, setActiveTab] = useState('system');
  const [showToolGenerator, setShowToolGenerator] = useState(false);
  const [showSkillGenerator, setShowSkillGenerator] = useState(false);

  useEffect(() => {
    if (agent.tools) tools.setItems(agent.tools);
    if (agent.mcp) mcp.setItems(agent.mcp);
    if (agent.skills) skills.setItems(agent.skills);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...agent,
      name: name.trim(),
      role: role.trim(),
      systemPrompt,
      outputConstraints,
      tools: tools.items,
      mcp: mcp.items,
      skills: skills.items,
      isConfigured: true,
    });
  };

  const CTX = {
    tools: { title: `${t('agent.config')} - 工具`, emptyLabel: '暂无工具', presets: PRESET_TOOLS },
    mcp: { title: `${t('agent.config')} - MCP`, emptyLabel: '暂无 MCP', presets: PRESET_MCP },
    skills: { title: `${t('agent.config')} - Skills`, emptyLabel: '暂无 Skills', presets: PRESET_SKILLS },
  };

  const renderList = <T extends { id: string; name: string; description?: string; enabled: boolean }>(
    ctx: { title: string; emptyLabel: string; presets: { id: string; name: string; description?: string }[] },
    list: {
      items: T[];
      editingId: string | null;
      toggle: (id: string) => void;
      addCustom: (fn: () => T) => void;
      update: (id: string, u: Partial<T>) => void;
      remove: (id: string) => void;
      setEditingId: (v: string | null) => void;
    },
  ) => {
    return (
      <ConfigItemList
        title={ctx.title}
        items={list.items}
        presets={ctx.presets}
        editingId={list.editingId}
        emptyLabel={ctx.emptyLabel}
        onToggle={list.toggle}
        onAdd={() =>
          list.addCustom(() => ({ id: `custom-${Date.now()}`, name: '新项目', description: '', enabled: true }) as T)
        }
        onUpdate={(id, name, desc) => list.update(id, { name, description: desc } as Partial<T>)}
        onRemove={list.remove}
        onStartEdit={(id) => list.setEditingId(id)}
        onFinishEdit={() => list.setEditingId(null)}
      />
    );
  };

  const tabs = [
    { key: 'system', label: '系统提示词', icon: null },
    { key: 'output', label: '输出约束', icon: null },
    { key: 'tools', label: '工具', icon: Wrench, count: tools.getEnabledCount() },
    { key: 'mcp', label: 'MCP', icon: Server, count: mcp.getEnabledCount() },
    { key: 'skills', label: 'Skills', icon: Sparkles, count: skills.getEnabledCount() },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content agent-config-modal"
        onClick={(e) => e.stopPropagation()}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="agent-config-header">
            <div className={`agent-config-icon ${agent.bg} ${agent.border}`}>
              <agent.icon size={20} className={agent.color} />
            </div>
            <div>
              <h3>配置 Agent</h3>
              <p className="agent-config-subtitle">设置 {agent.name} 的能力和行为</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Agent 名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入 Agent 名称"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>Agent 描述</label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="如：前端开发工程师、后端 API 设计师..."
              className="form-input"
            />
            <p className="form-hint">简短描述该 Agent 的职责和专业领域</p>
          </div>
          <div className="agent-config-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`agent-config-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon && <tab.icon size={14} />}
                {tab.label}
                {tab.count && tab.count > 0 && <span className="tab-badge">{tab.count}</span>}
              </button>
            ))}
          </div>
          <div className="agent-config-content">
            {activeTab === 'system' && (
              <div className="form-group">
                <label>系统提示词 (System Prompt)</label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="定义该 Agent 的角色、职责和行为规则..."
                  className="form-textarea"
                  rows={12}
                />
                <p className="form-hint">系统提示词定义了 Agent 的核心身份和行为准则</p>
              </div>
            )}
            {activeTab === 'output' && (
              <div className="form-group">
                <label>输出约束 (Output Constraints)</label>
                <textarea
                  value={outputConstraints}
                  onChange={(e) => setOutputConstraints(e.target.value)}
                  placeholder="约束 Agent 的输出格式和行为..."
                  className="form-textarea"
                  rows={12}
                />
                <p className="form-hint">输出约束用于控制 Agent 的回复格式、长度、语言等具体要求</p>
                <div className="form-examples">
                  <span className="form-examples-label">常用约束：</span>
                  <div className="form-examples-list">
                    {['中文回复', '代码标识', 'Markdown', '字数限制'].map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        className="form-example-btn"
                        onClick={() =>
                          setOutputConstraints(
                            (prev) =>
                              prev +
                              (prev ? '\n' : '') +
                              `${i + 1}. ${['回复必须使用中文', '代码块必须包含语言标识', '使用 Markdown 格式化输出', '每次回复不超过 500 字'][i]}`,
                          )
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'tools' && (
              <>
                {showToolGenerator ? (
                  <ToolGenerator
                    onAdd={(tool) => {
                      tools.addCustom(() => ({ ...tool, enabled: true }) as AgentTool);
                      setShowToolGenerator(false);
                    }}
                    onClose={() => setShowToolGenerator(false)}
                  />
                ) : (
                  <>
                    <div className="tool-generator-trigger">
                      <button onClick={() => setShowToolGenerator(true)} className="btn btn-secondary btn-sm">
                        <Wand2 size={14} /> 用自然语言生成工具
                      </button>
                    </div>
                    {renderList(CTX.tools, tools)}
                  </>
                )}
              </>
            )}
            {activeTab === 'mcp' && renderList(CTX.mcp, mcp)}
            {activeTab === 'skills' && (
              <>
                {showSkillGenerator ? (
                  <SkillGenerator
                    onAdd={(skill) => {
                      skills.addCustom(() => ({ ...skill, enabled: true }) as AgentSkill);
                      setShowSkillGenerator(false);
                    }}
                    onClose={() => setShowSkillGenerator(false)}
                  />
                ) : (
                  <>
                    <div className="tool-generator-trigger">
                      <button onClick={() => setShowSkillGenerator(true)} className="btn btn-secondary btn-sm">
                        <Sparkles size={14} /> 用自然语言生成 Skill
                      </button>
                    </div>
                    {renderList(CTX.skills, skills)}
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
