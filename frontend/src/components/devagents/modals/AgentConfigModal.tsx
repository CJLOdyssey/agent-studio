import { useState, useEffect, useRef } from 'react';
import { X, Wrench, Server, Sparkles } from 'lucide-react';
import type { Agent, AgentTool, AgentMCP, AgentSkill } from '../../../types/devagents';
import { useTranslation } from 'react-i18next';
import { useItemList } from '../../../hooks/useItemList';
import ConfigItemList from './ConfigItemList';

interface Props {
  agent: Agent;
  onSave: (agent: Agent) => void;
  onClose: () => void;
}

// ── Tools: 开发人员定义，用户勾选 ──
// 每个 tool 对应后端一个真实的 function call schema
const PRESET_TOOLS: Omit<AgentTool, 'enabled'>[] = [
  { id: 'read_file',     name: '读取文件',     description: '读取工作区文件内容' },
  { id: 'write_file',    name: '写入文件',     description: '创建或修改工作区文件' },
  { id: 'list_files',    name: '列出文件',     description: '列出目录中的文件列表' },
  { id: 'search_code',   name: '搜索代码',     description: '在代码库中搜索符号和文本' },
  { id: 'run_command',   name: '终端命令',     description: '执行 Shell 命令并返回输出' },
  { id: 'web_search',    name: '网络搜索',     description: '搜索互联网获取最新信息' },
  { id: 'web_fetch',     name: '网页抓取',     description: '抓取指定 URL 的网页内容' },
  { id: 'run_tests',     name: '运行测试',     description: '执行测试套件并返回结果' },
  { id: 'git_diff',      name: 'Git 差异',     description: '查看代码变更差异' },
  { id: 'lint_check',    name: '代码检查',     description: '运行 Linter 检查代码质量' },
];

// ── MCP: 标准协议，连接外部服务 ──
// 用户可添加自己的 MCP server URL
const PRESET_MCP: Omit<AgentMCP, 'enabled'>[] = [
  { id: 'filesystem',  name: '文件系统',    serverUrl: 'http://localhost:8100/mcp' },
  { id: 'github',      name: 'GitHub',      serverUrl: 'https://api.github.com/mcp' },
  { id: 'postgres',    name: 'PostgreSQL',  serverUrl: 'http://localhost:8101/mcp' },
  { id: 'brave-search', name: 'Brave 搜索', serverUrl: 'https://api.search.brave.com/mcp' },
  { id: 'puppeteer',   name: '浏览器操作',  serverUrl: 'http://localhost:8102/mcp' },
];

// ── Skills: Prompt 模板，用户可自定义 ──
// 本质是预制的 system prompt 片段，告诉 LLM 如何执行特定任务
const PRESET_SKILLS: Omit<AgentSkill, 'enabled'>[] = [
  { id: 'code-review',    name: '代码审查',     description: '审查代码质量、安全性和可维护性' },
  { id: 'test-gen',       name: '测试生成',     description: '自动生成单元测试和集成测试' },
  { id: 'refactor',       name: '代码重构',     description: '重构代码结构和命名' },
  { id: 'api-design',     name: 'API 设计',     description: '设计 RESTful API 接口规范' },
  { id: 'db-design',      name: '数据库设计',   description: '设计数据库表结构和索引' },
  { id: 'ui-design',      name: 'UI 设计',      description: '设计用户界面和交互流程' },
  { id: 'docs-gen',       name: '文档生成',     description: '生成 API 文档和 README' },
  { id: 'security-audit', name: '安全审计',     description: '检查代码安全漏洞和风险' },
  { id: 'perf-optimize',  name: '性能优化',     description: '分析和优化系统性能瓶颈' },
  { id: 'debug',          name: '调试排错',     description: '分析错误日志并定位根因' },
];

export default function AgentConfigModal({ agent, onSave, onClose }: Props) {
  const { t } = useTranslation();
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
  const tools = useItemList<AgentTool>(PRESET_TOOLS.map(t => ({ ...t, enabled: false })));
  const mcp = useItemList<AgentMCP>(PRESET_MCP.map(t => ({ ...t, enabled: false })));
  const skills = useItemList<AgentSkill>(PRESET_SKILLS.map(t => ({ ...t, enabled: false })));

  const [name, setName] = useState(agent.name);
  const [role, setRole] = useState(agent.role);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || '');
  const [outputConstraints, setOutputConstraints] = useState(agent.outputConstraints || '');
  const [activeTab, setActiveTab] = useState('system');

  useEffect(() => {
    if (agent.tools) tools.setItems(agent.tools);
    if (agent.mcp) mcp.setItems(agent.mcp);
    if (agent.skills) skills.setItems(agent.skills);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ ...agent, name: name.trim(), role: role.trim(), systemPrompt, outputConstraints, tools: tools.items, mcp: mcp.items, skills: skills.items, isConfigured: true });
  };

  const CTX = {
    tools: { title: `${t('agent.config')} - 工具`, emptyLabel: '暂无工具', presets: PRESET_TOOLS },
    mcp:   { title: `${t('agent.config')} - MCP`, emptyLabel: '暂无 MCP', presets: PRESET_MCP },
    skills:{ title: `${t('agent.config')} - Skills`, emptyLabel: '暂无 Skills', presets: PRESET_SKILLS },
  };

  const renderList = <T extends { id: string; name: string; description?: string; enabled: boolean }>(
    ctx: { title: string; emptyLabel: string; presets: { id: string; name: string; description?: string }[] },
    list: { items: T[]; editingId: string | null; toggle: (id: string) => void; addCustom: (fn: () => T) => void; update: (id: string, u: Partial<T>) => void; remove: (id: string) => void; setEditingId: (v: string | null) => void }
  ) => {
    return (
    <ConfigItemList
      title={ctx.title} items={list.items} presets={ctx.presets}
      editingId={list.editingId} emptyLabel={ctx.emptyLabel}
      onToggle={list.toggle}
      onAdd={() => list.addCustom(() => ({ id: `custom-${Date.now()}`, name: '新项目', description: '', enabled: true } as T))}
      onUpdate={(id, name, desc) => list.update(id, { name, description: desc } as Partial<T>)}
      onRemove={list.remove}
      onStartEdit={(id) => list.setEditingId(id)}
      onFinishEdit={() => list.setEditingId(null)}
    />
  )};


  const tabs = [
    { key: 'system', label: '系统提示词', icon: null },
    { key: 'output', label: '输出约束', icon: null },
    { key: 'tools', label: '工具', icon: Wrench, count: tools.getEnabledCount() },
    { key: 'mcp', label: 'MCP', icon: Server, count: mcp.getEnabledCount() },
    { key: 'skills', label: 'Skills', icon: Sparkles, count: skills.getEnabledCount() },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content agent-config-modal" onClick={e => e.stopPropagation()} ref={modalRef} role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="agent-config-header">
            <div className={`agent-config-icon ${agent.bg} ${agent.border}`}><agent.icon size={20} className={agent.color} /></div>
            <div><h3>配置 Agent</h3><p className="agent-config-subtitle">设置 {agent.name} 的能力和行为</p></div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Agent 名称</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="请输入 Agent 名称" className="form-input" />
          </div>
          <div className="form-group">
            <label>Agent 描述</label>
            <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="如：前端开发工程师、后端 API 设计师..." className="form-input" />
            <p className="form-hint">简短描述该 Agent 的职责和专业领域</p>
          </div>
          <div className="agent-config-tabs">
            {tabs.map(tab => (
              <button key={tab.key} className={`agent-config-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
                {tab.icon && <tab.icon size={14} />}{tab.label}
                {tab.count && tab.count > 0 && <span className="tab-badge">{tab.count}</span>}
              </button>
            ))}
          </div>
          <div className="agent-config-content">
            {activeTab === 'system' && (
              <div className="form-group">
                <label>系统提示词 (System Prompt)</label>
                <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder="定义该 Agent 的角色、职责和行为规则..." className="form-textarea" rows={12} />
                <p className="form-hint">系统提示词定义了 Agent 的核心身份和行为准则</p>
              </div>
            )}
            {activeTab === 'output' && (
              <div className="form-group">
                <label>输出约束 (Output Constraints)</label>
                <textarea value={outputConstraints} onChange={e => setOutputConstraints(e.target.value)} placeholder="约束 Agent 的输出格式和行为..." className="form-textarea" rows={12} />
                <p className="form-hint">输出约束用于控制 Agent 的回复格式、长度、语言等具体要求</p>
                <div className="form-examples">
                  <span className="form-examples-label">常用约束：</span>
                  <div className="form-examples-list">
                    {['中文回复', '代码标识', 'Markdown', '字数限制'].map((label, i) => (
                      <button key={label} type="button" className="form-example-btn" onClick={() => setOutputConstraints(prev => prev + (prev ? '\n' : '') + `${i + 1}. ${['回复必须使用中文', '代码块必须包含语言标识', '使用 Markdown 格式化输出', '每次回复不超过 500 字'][i]}`)}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'tools' && renderList(CTX.tools, tools)}
            {activeTab === 'mcp' && renderList(CTX.mcp, mcp)}
            {activeTab === 'skills' && renderList(CTX.skills, skills)}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!name.trim()}>保存配置</button>
        </div>
      </div>
    </div>
  );
}
