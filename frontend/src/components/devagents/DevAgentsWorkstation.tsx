import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Bot, Send, Paperclip, Layout, ChevronRight, MessageSquare } from 'lucide-react';
import type { Agent, Team, WorkspaceTab } from '../../types/devagents';
import TeamMessage from './TeamMessage';
import DevAgentsSidebar from './DevAgentsSidebar';
import ChatInputArea from './ChatInputArea';
import Workspace from './workspace/Workspace';
import { useToast } from '../../utils/useToast';
import { useTeamManagement } from '../../hooks/useTeamManagement';
import { useConversation } from '../../hooks/useConversation';
import { useSettings, useNotificationSound } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import Logger from '../../utils/logger';
import { validateInput } from '../../utils/validation';

const AgentConfigModal = lazy(() => import('./modals/AgentConfigModal'));
const SettingsModal = lazy(() => import('./modals/SettingsModal'));
const ApiManagementModal = lazy(() => import('./modals/ApiManagementModal'));
const ConfirmModal = lazy(() => import('./modals/ConfirmModal'));
const NewProjectModal = lazy(() => import('./modals/NewProjectModal'));

function GreetingAnimation() {
  const { t } = useTranslation();
  const greeting = t('home.greeting');
  const [displayed, setDisplayed] = useState('');
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      if (index < greeting.length) {
        setDisplayed(greeting.slice(0, index + 1));
        index++;
      } else { setComplete(true); clearInterval(timer); }
    }, 100);
    return () => clearInterval(timer);
  }, [greeting]);

  return (
    <h1 className="devagents-home-greeting">{displayed}{!complete && <span className="typing-cursor">|</span>}</h1>
  );
}

export default function DevAgentsWorkstation() {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('code');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);

  const teamMgmt = useTeamManagement(toast);
  const conv = useConversation();
  const { settings } = useSettings();
  const { t } = useTranslation();
  const notify = useNotificationSound();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [configuringAgent, setConfiguringAgent] = useState<Agent | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiOpen, setIsApiOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void; danger?: boolean } | null>(null);

  const [conversationKey, setConversationKey] = useState(0);
  const convRef = useRef(conv);
  useEffect(() => { convRef.current = conv; });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv.agentMessages, conv.homeMessages, selectedAgentId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        const c = convRef.current;
        if (c.homeMessages.length > 0 && c.activeConvId) c.saveCurrentConversation();
        setSelectedAgentId(null);
        c.setActiveConvId(null);
        c.setHomeMessages([]);
        setInputValue('');
        setConversationKey(prev => prev + 1);
        toast(t('toast.newChat'), 'info');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [t, toast]);

  const handleSendMessage = useCallback(() => {
    const { valid, sanitized } = validateInput(inputValue);
    setInputValue('');
    if (!valid) return;
    conv.handleSendMessage(sanitized, selectedAgentId, teamMgmt.allAgents);
    notify();
  }, [inputValue, selectedAgentId, teamMgmt.allAgents, conv, notify]);

  const toggleWorkspaceFullscreen = useCallback(async () => {
    if (!workspaceRef.current) return;
    try {
      if (!document.fullscreenElement) await workspaceRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) { Logger.error('Fullscreen error:', err); }
  }, []);

  const handleSidebarAddAgent = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation(); teamMgmt.handleAddAgent(id);
  }, [teamMgmt]);

  const handleSidebarStartEditTeam = useCallback((e: React.MouseEvent, team: Team) => {
    e.stopPropagation(); teamMgmt.startEditTeam(team);
  }, [teamMgmt]);

  const handleSidebarDeleteTeam = useCallback((e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    setConfirmDialog({ title: t('sidebar.deleteTeam'), message: t('confirm.deleteTeam'), danger: true, onConfirm: () => { teamMgmt.handleDeleteTeam(teamId); setConfirmDialog(null); } });
  }, [teamMgmt, setConfirmDialog, t]);

  const handleSidebarDeleteAgent = useCallback((e: React.MouseEvent, teamId: string, agentId: string) => {
    e.stopPropagation();
    setConfirmDialog({ title: t('sidebar.deleteAgent'), message: t('confirm.deleteAgent'), danger: true, onConfirm: () => { teamMgmt.handleDeleteAgent(teamId, agentId); setConfirmDialog(null); } });
  }, [teamMgmt, setConfirmDialog, t]);

  const handleSidebarAgentClick = useCallback((agent: Agent) => {
    setSelectedAgentId(agent.id); setIsWorkspaceOpen(false);
  }, [setSelectedAgentId, setIsWorkspaceOpen]);

  const handleSidebarOpenAgentConfig = useCallback((e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation(); setConfiguringAgent(agent);
  }, [setConfiguringAgent]);

  return (
    <div className="devagents-layout">
      <DevAgentsSidebar
        teams={teamMgmt.teams}
        selectedAgentId={selectedAgentId}
        editingTeamId={teamMgmt.editingTeamId}
        editTeamName={teamMgmt.editTeamName}
        setEditTeamName={teamMgmt.setEditTeamName}
        conversations={conv.conversations}
        activeConvId={conv.activeConvId}
        homeMessages={conv.homeMessages}
        isUserMenuOpen={isUserMenuOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        setIsApiOpen={setIsApiOpen}
        setSelectedAgentId={setSelectedAgentId}
        setActiveConvId={conv.setActiveConvId}
        setHomeMessages={conv.setHomeMessages}
        setInputValue={setInputValue}
        setConversationKey={setConversationKey}
        setConversations={conv.setConversations}
        toggleTeam={teamMgmt.toggleTeam}
        handleAddTeam={teamMgmt.handleAddTeam}
        handleAddAgent={handleSidebarAddAgent}
        startEditTeam={handleSidebarStartEditTeam}
        saveTeamName={teamMgmt.saveTeamName}
        handleTeamNameKeyDown={teamMgmt.handleTeamNameKeyDown}
        handleDeleteTeam={handleSidebarDeleteTeam}
        handleDeleteAgent={handleSidebarDeleteAgent}
        handleAgentClick={handleSidebarAgentClick}
        handleOpenAgentConfig={handleSidebarOpenAgentConfig}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
      />

      {isSidebarOpen && <div className="devagents-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />}

      <main className="devagents-main" id="main-content">
        <button className="devagents-hamburger" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle sidebar">
          <MessageSquare size={18} />
        </button>

        {selectedAgentId && (
          <header className="devagents-header">
            <div className="devagents-header-title">
              {(() => {
                const agent = teamMgmt.allAgents.find(a => a.id === selectedAgentId);
                return agent ? (
                  <><div className={`devagents-agent-icon-sm ${agent.bg} ${agent.border}`}><agent.icon size={14} className={agent.color} /></div>{agent.name}</>
                ) : <><MessageSquare size={16} /></>;
              })()}
              <button onClick={() => setSelectedAgentId(null)} className="devagents-back-btn" title="返回">
                <ChevronRight size={14} className="rotate-180" />{t('workspace.back')}
              </button>
            </div>
            {!isWorkspaceOpen && (
              <button onClick={() => setIsWorkspaceOpen(true)} className="devagents-open-workspace-btn">
                <Layout size={14} />{t('workspace.open')}
              </button>
            )}
          </header>
        )}

        <div className="devagents-messages">
          {selectedAgentId ? (
            <div className="devagents-messages-inner" aria-live="polite">
              {!welcomeDismissed && (
                <div className="devagents-agent-welcome">
                  <button className="devagents-welcome-close" onClick={() => setWelcomeDismissed(true)} aria-label={t('common.close')}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                  <div className="devagents-agent-welcome-icon">
                    {(() => { const a = teamMgmt.allAgents.find(x => x.id === selectedAgentId); return a ? <a.icon size={32} className={a.color} /> : <Bot size={32} />; })()}
                  </div>
                  <h3>{t('agent.startChat', { name: teamMgmt.allAgents.find(a => a.id === selectedAgentId)?.name || '' })}</h3>
                  <p>{t('agent.welcome')}</p>
                </div>
              )}
              {(conv.agentMessages[selectedAgentId] || []).map(msg => <TeamMessage key={msg.id} msg={msg} allAgents={teamMgmt.allAgents} />)}
              <div ref={messagesEndRef} />
            </div>
          ) : conv.homeMessages.length === 0 ? (
            <div className="devagents-home">
              <div className="devagents-home-centered">
                <div className="devagents-home-group">
                  <div className="devagents-home-hero">
                    <div className="devagents-home-logo" role="img" tabIndex={-1} aria-label="DevAgents Logo"><Bot size={48} className="text-[var(--icon-planning)]" /></div>
                    <GreetingAnimation key={conversationKey} />
                    <p className="devagents-home-subtitle">{t('home.subtitle')}</p>
                  </div>
                  <div className="devagents-samples">
                    {[['home.samples.login', '帮我设计一个用户登录页面的前端组件，包含邮箱、密码输入和验证码'],
                      ['home.samples.api', '分析现有API架构的性能瓶颈，给出优化建议'],
                      ['home.samples.auth', '编写一个用户权限管理的后端接口，包含角色和权限的 CRUD'],
                      ['home.samples.database', '为电商系统设计数据库表结构，包括用户、商品、订单、购物车'],
                    ].map(([key, text], i) => (
                      <button key={i} className="devagents-sample-btn" onClick={() => { setInputValue(text); }}>{t(key)}</button>
                    ))}
                  </div>
                  <div className="devagents-home-input">
                    <div className="devagents-input-wrapper">
                      <textarea value={inputValue} onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => {
                          const isSendKey = settings.sendMode === 'enter' ? (e.key === 'Enter' && !e.shiftKey) : (e.key === 'Enter' && (e.ctrlKey || e.metaKey));
                          if (isSendKey) { e.preventDefault(); handleSendMessage(); }
                        }}
                        placeholder={t('home.placeholder')} className="devagents-textarea" rows={2} />
                      <div className="devagents-input-toolbar">
                        <div className="devagents-input-tools">
                          <button className="devagents-tool-btn" title={t('home.attach')}><Paperclip size={16} /></button>
                          <button className="devagents-tool-btn-text">{t('home.commands')}</button>
                        </div>
                          <button onClick={handleSendMessage} disabled={!inputValue.trim()} className={`devagents-send-btn ${inputValue.trim() ? 'active' : 'disabled'}`}>
                          <span>{t('home.send')}</span><Send size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
        <div className="devagents-messages" aria-live="polite">
              <div className="devagents-home-chat-messages">
                {conv.homeMessages.map(msg => <TeamMessage key={msg.id} msg={msg} allAgents={teamMgmt.allAgents} />)}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {selectedAgentId && (
          <ChatInputArea
            selectedAgentId={selectedAgentId}
            homeMessagesLength={conv.homeMessages.length}
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleSendMessage={handleSendMessage}
            textareaRef={textareaRef}
            selectedModel="deepseek-chat"
            onModelChange={() => {}}
          />
        )}
      </main>

      <Workspace selectedAgentId={selectedAgentId} activeTab={activeTab} setActiveTab={setActiveTab} isWorkspaceOpen={isWorkspaceOpen} setIsWorkspaceOpen={setIsWorkspaceOpen} toggleWorkspaceFullscreen={toggleWorkspaceFullscreen} workspaceRef={workspaceRef} />

      <Suspense fallback={<div>{t('sidebar.loading')}</div>}>
        {configuringAgent && <AgentConfigModal agent={configuringAgent} onSave={teamMgmt.handleAgentConfigSave} onClose={() => setConfiguringAgent(null)} />}
        {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        {isApiOpen && <ApiManagementModal onClose={() => setIsApiOpen(false)} />}
        {isNewProjectOpen && <NewProjectModal onClose={() => setIsNewProjectOpen(false)} onCreateProject={() => { setSelectedAgentId(null); conv.setHomeMessages([]); setInputValue(''); }} />}
        {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} danger={confirmDialog.danger} confirmLabel="删除" />}
      </Suspense>
    </div>
  );
}
