import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Bot, Layout, ChevronRight, MessageSquare } from 'lucide-react';
import type { Agent, Team, WorkspaceTab } from '../../types/devagents';
import TeamMessage from './TeamMessage';
import DevAgentsSidebar from './DevAgentsSidebar';
import ChatInputArea from './ChatInputArea';
import Workspace from './workspace/Workspace';
import { useToast } from '../../utils/useToast';
import { useTeamManagement } from '../../hooks/useTeamManagement';
import { useConversation } from '../../hooks/useConversation';
import { useNotificationSound } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import { InputToolbar, type InputToolbarHandle } from '../input';
import type { AttachedFile } from '../input';
import { useAgents, useAvailableModels, useCommands } from '../../api/hooks';
import { useAgentCommands } from '../../hooks/useAgentCommands';
import { useChatStore } from '../../stores/chatStore';
import Logger from '../../utils/logger';

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
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('code');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const inputToolbarRef = useRef<InputToolbarHandle>(null);

  // Load real agent configs from backend via React Query
  const { data: agentConfigs } = useAgents();
  const models = useAvailableModels();
  const teamMgmt = useTeamManagement(agentConfigs, toast);

  // Commands for slash palette (API + agent MCP/skills/tools)
  const { data: apiCommands } = useCommands();
  const agentCommands = useAgentCommands(teamMgmt.teams);
  const allCommands = [
    ...(apiCommands ?? []).map((c) => ({ id: c.id, name: c.name, description: c.description, source: 'local' as const })),
    ...agentCommands,
  ];
  const conv = useConversation();
  const { t } = useTranslation();
  const notify = useNotificationSound();

  // Bridge to real API via Zustand chatStore
  const submitToApi = useChatStore((s) => s.submitRequirement);
  const wsStatus = useChatStore((s) => s.wsStatus);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [configuringAgent, setConfiguringAgent] = useState<Agent | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiOpen, setIsApiOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void; danger?: boolean } | null>(null);

  // Home page input: separate InputToolbar rendered when no agent selected + no messages
  // Key resets the input state when conversation changes
  const [conversationKey, setConversationKey] = useState(0);

  const convRef = useRef(conv);
  useEffect(() => { convRef.current = conv; });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conv.agentMessages, conv.homeMessages, selectedAgentId]);

  // ── Global keyboard shortcut: Ctrl+N new chat ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        const c = convRef.current;
        if (c.homeMessages.length > 0 && c.activeConvId) c.saveCurrentConversation();
        setSelectedAgentId(null);
        c.setActiveConvId(null);
        c.setHomeMessages([]);
        // input state is self-contained in InputToolbar — no need to reset
        setConversationKey(prev => prev + 1);
        toast(t('toast.newChat'), 'info');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [t, toast]);

  // ── Send handler — bridges InputToolbar/ChatInputArea to conv + API ──
  const handleSendMessage = useCallback(
    (text: string, _files: AttachedFile[], _model: string) => {
      // Local UI update (mock fallback)
      conv.handleSendMessage(text, selectedAgentId, teamMgmt.allAgents);

      // Real API submission
      if (agentConfigs && agentConfigs.length > 0) {
        submitToApi(text).catch(() => {
          Logger.warn('API submission failed, using mock fallback');
        });
      }

      notify();
      // input state is self-contained in InputToolbar — no need to reset
    },
    [selectedAgentId, teamMgmt.allAgents, conv, notify, agentConfigs, submitToApi],
  );

  // Home page send handler (no agent selected)
  const handleHomeSend = useCallback(
    (text: string, _files: AttachedFile[]) => {
      conv.handleSendMessage(text, null, teamMgmt.allAgents);

      if (agentConfigs && agentConfigs.length > 0) {
        submitToApi(text).catch(() => {
          Logger.warn('API submission failed, using mock fallback');
        });
      }

      notify();
      // input state is self-contained in InputToolbar — no need to reset
    },
    [teamMgmt.allAgents, conv, notify, agentConfigs, submitToApi],
  );

  // ── Page-level drag-and-drop ──
  // Files dropped anywhere on the chat area are attached to the current input.
  // This is the only drag-drop handler — InputToolbar itself has no drag zone.

  const [isPageDragOver, setIsPageDragOver] = useState(false);

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsPageDragOver(true);
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent) => {
    // Only set false when leaving the main area entirely
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsPageDragOver(false);
    }
  }, []);

  const handlePageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsPageDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      inputToolbarRef.current?.addFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

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

  // ── Render ──

  const showAgentChat = selectedAgentId !== null;
  const hasHomeMessages = conv.homeMessages.length > 0;

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
        setInputValue={() => {}}
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

      <main
        className={`devagents-main ${isPageDragOver ? 'devagents-drag-over' : ''}`}
        id="main-content"
        onDragOver={handlePageDragOver}
        onDragLeave={handlePageDragLeave}
        onDrop={handlePageDrop}
      >
        {isPageDragOver && (
          <div className="devagents-page-drop-overlay">
            <span>{t('fileAttach.dropHere')}</span>
          </div>
        )}
        {wsStatus === 'reconnecting' && (
          <div className="devagents-ws-banner" role="status" aria-live="polite">
            {t('common.connecting')}...
          </div>
        )}
        <button className="devagents-hamburger" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle sidebar">
          <MessageSquare size={18} />
        </button>

        {showAgentChat && (
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
          {showAgentChat ? (
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
              {(conv.agentMessages[selectedAgentId!] || []).map(msg => <TeamMessage key={msg.id} msg={msg} allAgents={teamMgmt.allAgents} />)}
              <div ref={messagesEndRef} />
            </div>
          ) : !hasHomeMessages ? (
            <div className="devagents-home">
              <div className="devagents-home-centered">
                <div className="devagents-home-group">
                  <div className="devagents-home-hero">
                    <div className="devagents-home-logo" role="img" tabIndex={-1} aria-label="DevAgents Logo"><Bot size={48} className="text-[var(--icon-planning)]" /></div>
                    <GreetingAnimation key={conversationKey} />
                    <p className="devagents-home-subtitle">{t('home.subtitle')}</p>
                  </div>
                  <div className="devagents-samples">
                    {[
                      ['home.samples.login', '帮我设计一个用户登录页面的前端组件，包含邮箱、密码输入和验证码'],
                      ['home.samples.api', '分析现有API架构的性能瓶颈，给出优化建议'],
                      ['home.samples.auth', '编写一个用户权限管理的后端接口，包含角色和权限的 CRUD'],
                      ['home.samples.database', '为电商系统设计数据库表结构，包括用户、商品、订单、购物车'],
                    ].map(([key, text]) => (
                      <button
                        key={key}
                        className="devagents-sample-btn"
                        onClick={() => {
                          // Pre-fill via DOM since input state lives in InputToolbar
                          const ta = document.querySelector('.devagents-textarea') as HTMLTextAreaElement;
                          if (ta) {
                            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                              window.HTMLTextAreaElement.prototype, 'value'
                            )!.set!;
                            nativeInputValueSetter.call(ta, text);
                            ta.dispatchEvent(new Event('input', { bubbles: true }));
                            ta.focus();
                          }
                        }}
                      >
                        {t(key)}
                      </button>
                    ))}
                  </div>
                  <div className="devagents-home-input">
                    <InputToolbar
                      ref={inputToolbarRef}
                      key={conversationKey}
                      onSend={handleHomeSend}
                      models={models}
                      selectedModel={models[0]?.id ?? ''}
                      onModelChange={() => {}}
                      onConfigureModels={() => setIsApiOpen(true)}
                      commands={allCommands}
                    />
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

        <ChatInputArea
          ref={inputToolbarRef}
          visible={showAgentChat || hasHomeMessages}
          onSend={handleSendMessage}
          onConfigureModels={() => setIsApiOpen(true)}
          teams={teamMgmt.teams}
        />
      </main>

      <Workspace selectedAgentId={selectedAgentId} activeTab={activeTab} setActiveTab={setActiveTab} isWorkspaceOpen={isWorkspaceOpen} setIsWorkspaceOpen={setIsWorkspaceOpen} toggleWorkspaceFullscreen={toggleWorkspaceFullscreen} workspaceRef={workspaceRef} />

      <Suspense fallback={<div>{t('sidebar.loading')}</div>}>
        {configuringAgent && <AgentConfigModal agent={configuringAgent} onSave={teamMgmt.handleAgentConfigSave} onClose={() => setConfiguringAgent(null)} />}
        {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
        {isApiOpen && <ApiManagementModal onClose={() => setIsApiOpen(false)} />}
        {isNewProjectOpen && <NewProjectModal onClose={() => setIsNewProjectOpen(false)} onCreateProject={() => { setSelectedAgentId(null); conv.setHomeMessages([]); setConversationKey(prev => prev + 1); }} />}
        {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} danger={confirmDialog.danger} confirmLabel="删除" />}
      </Suspense>
    </div>
  );
}
