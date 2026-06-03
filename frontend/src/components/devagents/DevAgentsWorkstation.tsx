import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Bot, ChevronRight, MessageSquare } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { Agent, Team, WorkspaceTab, Message } from '../../types/devagents';
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
import { getAgentResponse, getHomeResponse, getAgentGreeting } from '../../utils/agentResponses';
import Logger from '../../utils/logger';

const AgentConfigModal = lazy(() => import('./modals/AgentConfigModal'));
const SettingsModal = lazy(() => import('./modals/SettingsModal'));
const ApiManagementModal = lazy(() => import('./modals/ApiManagementModal'));
const ConfirmModal = lazy(() => import('./modals/ConfirmModal'));
const NewProjectModal = lazy(() => import('./modals/NewProjectModal'));

const AGENT_IDS = ['pm', 'architect', 'ui', 'frontend', 'backend', 'qa', 'devops', 'fullstack'] as const;

function buildInitialAgentMessages(t: TFunction): Record<string, Message[]> {
  const initial: Record<string, Message[]> = {};
  for (const id of AGENT_IDS) {
    initial[id] = [
      { id: AGENT_IDS.indexOf(id) + 1, role: 'agent', agentId: id, content: getAgentGreeting(id, t) },
    ];
  }
  return initial;
}

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

  // ── Data sources ──────────────────────────────────────────────────────────
  const { data: agentConfigs } = useAgents();
  const models = useAvailableModels();
  const teamMgmt = useTeamManagement(toast);
  const { data: apiCommands } = useCommands();
  const agentCommands = useAgentCommands(teamMgmt.teams);
  const conv = useConversation();
  const { t } = useTranslation();
  const notify = useNotificationSound();

  // API mode — single source of truth for real-time messages
  const apiMessages = useChatStore((s) => s.messages);
  const apiStatus = useChatStore((s) => s.status);
  const apiError = useChatStore((s) => s.error);
  const wsStatus = useChatStore((s) => s.wsStatus);
  const submitToApi = useChatStore((s) => s.submitRequirement);
  const resetApi = useChatStore((s) => s.reset);

  // Determine mode: API or mock
  const isApiAvailable = agentConfigs && agentConfigs.length > 0;

  // ── Local UI state ────────────────────────────────────────────────────────
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

  // Mock-mode state (only used when no API agents configured)
  const [homeMessages, setHomeMessages] = useState<Message[]>([]);
  const [agentMessages, setAgentMessages] = useState<Record<string, Message[]>>(() => buildInitialAgentMessages(t));

  // Display mode: API messages or local mock messages
  const hasRealMessages = isApiAvailable && apiMessages.length > 0;
  const showAgentChat = selectedAgentId !== null;
  const hasHomeContent = hasRealMessages || homeMessages.length > 0;

  // ── Refs for callbacks ────────────────────────────────────────────────────
  const convRef = useRef(conv);
  useEffect(() => { convRef.current = conv; });

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [apiMessages, agentMessages, homeMessages, selectedAgentId]);

  // ── Global keyboard shortcut: Ctrl+N new chat ────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (apiMessages.length > 0 && convRef.current.activeConvId) {
          convRef.current.updateConversationMessages(convRef.current.activeConvId, apiMessages);
        }
        resetApi();
        setSelectedAgentId(null);
        convRef.current.setActiveConvId(null);
        setHomeMessages([]);
        setConversationKey((prev) => prev + 1);
        toast(t('toast.newChat'), 'info');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [t, toast, apiMessages, resetApi]);

  // ── Send handler ──────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    (text: string, _files: AttachedFile[], _model: string) => {
      if (isApiAvailable) {
        // API mode — use chatStore exclusively
        submitToApi(text).catch(() => {
          Logger.warn('API submission failed');
        });
      } else {
        // Mock mode — generate local AI response
        const now = Date.now();
        const userMsg: Message = { id: now, role: 'user', content: text, timestamp: now };

        if (selectedAgentId) {
          setAgentMessages((prev) => ({
            ...prev,
            [selectedAgentId]: [...(prev[selectedAgentId] || []), userMsg],
          }));
          const typingMsg: Message = {
            id: now + 1, role: 'agent', agentId: selectedAgentId,
            content: t('agent.thinking', { name: teamMgmt.allAgents.find((a) => a.id === selectedAgentId)?.name || 'Agent' }),
            isTyping: true, timestamp: now,
          };
          setTimeout(() => {
            setAgentMessages((prev) => ({ ...prev, [selectedAgentId]: [...(prev[selectedAgentId] || []), typingMsg] }));
          }, 300);
          setTimeout(() => {
            const reply: Message = {
              id: now + 2, role: 'agent', agentId: selectedAgentId,
              content: getAgentResponse(selectedAgentId, t), timestamp: now + 2,
            };
            setAgentMessages((prev) => ({
              ...prev,
              [selectedAgentId]: [...(prev[selectedAgentId] || []).filter((m) => m.id !== typingMsg.id), reply],
            }));
          }, 1000 + Math.random() * 1000);
        }
      }
      notify();
    },
    [isApiAvailable, selectedAgentId, teamMgmt.allAgents, t, notify, submitToApi],
  );

  // Home page send handler
  const handleHomeSend = useCallback(
    (text: string, _files: AttachedFile[]) => {
      if (isApiAvailable) {
        // API mode — auto-create conversation, then submit
        const convId = conv.activeConvId ?? conv.saveConversation(text, []);
        if (convId) conv.setActiveConvId(convId);
        submitToApi(text).catch(() => {
          Logger.warn('API submission failed');
        });
      } else {
        // Mock mode
        const now = Date.now();
        const userMsg: Message = { id: now, role: 'user', content: text, timestamp: now };

        const convId = conv.activeConvId;
        if (!convId) {
          conv.saveConversation(text, []);
        }
        setHomeMessages((prev) => [...prev, userMsg]);

        const typingMsg: Message = {
          id: now + 1, role: 'agent', agentId: 'pm',
          content: t('agent.thinking', { name: '需求分析助手' }),
          isTyping: true, timestamp: now,
        };
        setTimeout(() => { setHomeMessages((prev) => [...prev, typingMsg]); }, 300);
        setTimeout(() => {
          const reply: Message = {
            id: now + 2, role: 'agent', agentId: 'pm',
            content: getHomeResponse(text, t), timestamp: now + 2,
          };
          setHomeMessages((prev) => [...prev.filter((m) => m.id !== typingMsg.id), reply]);
        }, 1000 + Math.random() * 1000);
      }
      notify();
    },
    [isApiAvailable, conv, t, notify, submitToApi, setHomeMessages],
  );

  // ── Page-level drag-and-drop ──────────────────────────────────────────────
  const [isPageDragOver, setIsPageDragOver] = useState(false);

  const handlePageDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsPageDragOver(true);
  }, []);

  const handlePageDragLeave = useCallback((e: React.DragEvent) => {
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

  // ── Sidebar callbacks ─────────────────────────────────────────────────────
  const handleSidebarAddAgent = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation(); teamMgmt.handleAddAgent(id);
  }, [teamMgmt]);

  const handleSidebarStartEditTeam = useCallback((e: React.MouseEvent, team: Team) => {
    e.stopPropagation(); teamMgmt.startEditTeam(team);
  }, [teamMgmt]);

  const handleSidebarDeleteTeam = useCallback((e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    setConfirmDialog({ title: t('sidebar.deleteTeam'), message: t('confirm.deleteTeam'), danger: true, onConfirm: () => { teamMgmt.handleDeleteTeam(teamId); setConfirmDialog(null); } });
  }, [teamMgmt, t]);

  const handleSidebarDeleteAgent = useCallback((e: React.MouseEvent, teamId: string, agentId: string) => {
    e.stopPropagation();
    setConfirmDialog({ title: t('sidebar.deleteAgent'), message: t('confirm.deleteAgent'), danger: true, onConfirm: () => { teamMgmt.handleDeleteAgent(teamId, agentId); setConfirmDialog(null); } });
  }, [teamMgmt, t]);

  const handleSidebarAgentClick = useCallback((agent: Agent) => {
    setSelectedAgentId(agent.id); setIsWorkspaceOpen(false);
  }, []);

  const handleSidebarOpenAgentConfig = useCallback((e: React.MouseEvent, agent: Agent) => {
    e.stopPropagation(); setConfiguringAgent(agent);
  }, []);

  const allCommands = [
    ...(apiCommands ?? []).map((c) => ({ id: c.id, name: c.name, description: c.description, source: 'local' as const })),
    ...agentCommands,
  ];

  // ── Build message list for display ────────────────────────────────────────
  // In API mode: use chatStore messages. In mock mode: use local state.
  const getFallbackId = (() => { let i = 0; return () => ++i; })();
  const displayMessages: Message[] = isApiAvailable
    ? apiMessages.map((m) => {
        const fallbackId = getFallbackId();
        return {
          id: parseInt(m.id, 36) || fallbackId,
          role: m.role === 'user' ? 'user' : 'agent',
          agentId: m.role,
          content: m.content,
          timestamp: m.created_at ? new Date(m.created_at).getTime() : fallbackId,
        };
      })
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
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
        homeMessages={homeMessages}
        isUserMenuOpen={isUserMenuOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        setIsApiOpen={setIsApiOpen}
        setSelectedAgentId={setSelectedAgentId}
        setActiveConvId={conv.setActiveConvId}
        setHomeMessages={setHomeMessages}
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
        {apiStatus === 'error' && apiError && (
          <div className="devagents-ws-banner devagents-ws-banner--error" role="alert">
            {apiError}
          </div>
        )}
        <button className="devagents-hamburger" onClick={() => setIsSidebarOpen(!isSidebarOpen)} aria-label="Toggle sidebar">
          <MessageSquare size={18} />
        </button>

        {(showAgentChat || hasHomeContent) && (
          <header className="devagents-header">
            <div className="devagents-header-title">
              {showAgentChat ? (() => {
                const agent = teamMgmt.allAgents.find(a => a.id === selectedAgentId);
                return agent ? (
                  <><div className={`devagents-agent-icon-sm ${agent.bg} ${agent.border}`}><agent.icon size={14} className={agent.color} /></div>{agent.name}</>
                ) : <><MessageSquare size={16} /></>;
              })() : (
                <><MessageSquare size={16} /><span>{t('home.title')}</span></>
              )}
              <button onClick={() => {
                if (showAgentChat) {
                  setSelectedAgentId(null);
                } else {
                  resetApi();
                  setHomeMessages([]);
                }
              }} className="devagents-back-btn" title="返回">
                <ChevronRight size={14} className="rotate-180" />{t('workspace.back')}
              </button>
            </div>
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
              {/* API mode: show chatStore messages; Mock mode: show local agent messages */}
              {isApiAvailable
                ? displayMessages.map(msg => <TeamMessage key={msg.id} msg={msg} allAgents={teamMgmt.allAgents} />)
                : (agentMessages[selectedAgentId!] || []).map(msg => <TeamMessage key={msg.id} msg={msg} allAgents={teamMgmt.allAgents} />)
              }
              <div ref={messagesEndRef} />
            </div>
          ) : hasHomeContent ? (
            <div className="devagents-messages-inner" aria-live="polite">
              {isApiAvailable
                ? displayMessages.map(msg => <TeamMessage key={msg.id} msg={msg} allAgents={teamMgmt.allAgents} />)
                : homeMessages.map(msg => <TeamMessage key={msg.id} msg={msg} allAgents={teamMgmt.allAgents} />)
              }
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="devagents-home">
              <div className="devagents-home-centered">
                <div className="devagents-home-group">
                  <div className="devagents-home-hero">
                    <div className="devagents-home-logo" role="img" tabIndex={-1} aria-label="DevAgents Logo"><Bot size={48} className="text-[var(--icon-planning)]" /></div>
                    <GreetingAnimation key={conversationKey} />
                    <p className="devagents-home-subtitle">{t('home.subtitle')}</p>
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
          )}
        </div>

        <ChatInputArea
          ref={inputToolbarRef}
          visible={showAgentChat || hasHomeContent}
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
        {isNewProjectOpen && <NewProjectModal onClose={() => setIsNewProjectOpen(false)} onCreateProject={() => { setSelectedAgentId(null); setHomeMessages([]); resetApi(); setConversationKey(prev => prev + 1); }} />}
        {confirmDialog && <ConfirmModal title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(null)} danger={confirmDialog.danger} confirmLabel="删除" />}
      </Suspense>
    </div>
  );
}
