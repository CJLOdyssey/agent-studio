import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Agent, WorkspaceTab, Message } from '../../types/AgentStudio';
import { useToast } from '../../utils/useToast';
import { useTeamManagement } from '../../hooks/useTeamManagement';
import { useConversation } from '../../hooks/useConversation';
import { useNotificationSound, useSettings } from '../../contexts/SettingsContext';
import { useTranslation } from 'react-i18next';
import type { InputToolbarHandle, AttachedFile } from '../input';
import { useAgents, useAvailableModels, useCommands } from '../../api/hooks';
import { executeCommand } from '../../api/client';
import { useAgentCommands } from '../../hooks/useAgentCommands';
import { useChatStore } from '../../stores/chatStore';
import { submitRequirement, retry } from '../../stores/chatActions';
import { getSessionDetail } from '../../api/client/sessions';
import { buildPathTurns } from '../../utils/branchTurns';
import type { ProjectRun } from '../../types';
import { useDragAndDrop } from './useDragAndDrop';
import Logger from '../../utils/logger';
import type * as React from 'react';

// run 树工具：与 ragbase useHomeState 一致 — 目标 run 的父链 + 主子孙链，
// 分支切换视图整体加载目标分支全部消息（不在该分支的轮次仅视图隐藏，DB 留存）。
function buildRunPath(
  runs: ProjectRun[],
  fromRunId?: string | null,
): {
  path: ProjectRun[];
  active: string | null;
} {
  const byId = new Map(runs.map((r) => [r.id, r]));
  const latest = runs.reduce(
    (a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? '') > 0 ? b : a,
    runs[0],
  );
  const start = fromRunId && byId.has(fromRunId) ? byId.get(fromRunId) : latest;
  const path: ProjectRun[] = [];
  const seen = new Set<string>();
  let cur: ProjectRun | undefined = start;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parent_run_id ? byId.get(cur.parent_run_id) : undefined;
  }
  return { path, active: start?.id ?? latest?.id ?? null };
}

// 分支完整路径：目标 run 的父链（根在前）+ 主子孙链（每次取子分支，优先
// 选非当前视图所在分支，全部都在当前分支则取最新）。切分支后显示该分支的
// 全部消息，后续轮次跟随目标分支。
function buildBranchPath(
  runs: ProjectRun[],
  fromRunId: string,
  excludeRunIds: Set<string>,
): ProjectRun[] {
  const { path: parentPath } = buildRunPath(runs, fromRunId);
  const byParent = new Map<string, ProjectRun[]>();
  for (const r of runs) {
    const p = r.parent_run_id;
    if (!p) continue;
    const list = byParent.get(p);
    if (list) list.push(r);
    else byParent.set(p, [r]);
  }
  const tail: ProjectRun[] = [];
  const seen = new Set<string>(parentPath.map((r) => r.id));
  let cur: string | null = fromRunId;
  while (cur) {
    const kids: ProjectRun[] = (byParent.get(cur) ?? [])
      .filter((k) => !seen.has(k.id))
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    const next: ProjectRun | undefined =
      kids.find((k) => !excludeRunIds.has(k.id)) ?? kids[0];
    if (!next) break;
    tail.push(next);
    seen.add(next.id);
    cur = next.id;
  }
  return [...parentPath, ...tail];
}

export function useWorkstationState(
  messagesContainerRef: React.RefObject<HTMLDivElement | null>,
  workspaceRef: React.RefObject<HTMLElement | null>,
  inputToolbarRef: React.RefObject<InputToolbarHandle | null>,
) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const notify = useNotificationSound();

  const teamMgmt = useTeamManagement(toast);
  const conv = useConversation();
  useAgents();
  const { data: apiCommands } = useCommands();
  const models = useAvailableModels();
  const agentCommands = useAgentCommands(teamMgmt.teams);

  const apiMessages = useChatStore((s) => s.messages);
  const apiStatus = useChatStore((s) => s.status);
  const apiError = useChatStore((s) => s.error);
  const wsStatus = useChatStore((s) => s.wsStatus);
  const submitToApi = submitRequirement;
  const resetApi = useChatStore((s) => s.reset);
  const cancelRun = useChatStore((s) => s.cancelRun);
  const retryApi = retry;
  const loadConversation = useChatStore((s) => s.loadConversation);
  const abandonedRunId = useChatStore((s) => s.lastAbandonedRunId);

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [configuringAgent, setConfiguringAgent] = useState<Agent | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isApiOpen, setIsApiOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);
  const [conversationKey, setConversationKey] = useState(0);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>('code');
  const [selectedModel, setSelectedModelState] = useState(() => {
    try {
      return localStorage.getItem('agentstudio-selected-model') || '';
    } catch {
      return '';
    }
  });
  const [isWorkstationOpen, setIsWorkstationOpen] = useState(false);
  const { settings, updateSettings } = useSettings();
  const isDarkMode = settings.theme === 'dark';
  const activeTeamId = useChatStore((s) => s.activeTeamId);
  const activeTeamName = useMemo(() => {
    if (!activeTeamId) return undefined;
    return teamMgmt.teams.find(t => t.id === activeTeamId)?.name;
  }, [activeTeamId, teamMgmt.teams]);
  const showAgentChat = selectedAgentId !== null || activeTeamId !== null;
  // 会话标识单一事实源 = URL 路由 /chat/:sessionId（对齐 ragbase/DeepSeek：
  // 可分享/收藏/多标签独立/前进后退）；localStorage 仅作 fallback。
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const activeConvId = sessionId ?? null;
  // 会话加载中（恢复/切换，消息未就绪）— 期间渲染消息面板而非主页，
  // 避免刷新/点击后主页一闪而过。
  const [restoring, setRestoring] = useState<boolean>(
    () => sessionId !== undefined || !!localStorage.getItem('agentstudio-active-conv-id'),
  );

  const filteredConversations = useMemo(() => conv.conversations, [conv.conversations]);

  const effectiveSelectedModel = useMemo(() => {
    if (selectedModel && models.some((m) => m.id === selectedModel)) return selectedModel;
    // 未显式选择时，默认取用户最近使用过的模型（agentstudio-recent-models
    // 顶部第一个），否则回退到列表第一个。选模型会触发 setSelectedModelState，
    // 使本 memo 重算并读到最新 recent 列表。
    try {
      const raw = localStorage.getItem('agentstudio-recent-models');
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const recent = parsed.find((x): x is string => typeof x === 'string' && models.some((m) => m.id === x));
        if (recent) return recent;
      }
    } catch {
      // non-fatal — fall through to no model selected
    }
    return '';
  }, [selectedModel, models]);
  // Persist the selected model so chatActions can route the request to the
  // key whose models contain it (a SiliconFlow model must hit SiliconFlow).
  const setSelectedModel = useCallback((id: string) => {
    setSelectedModelState(id);
    try {
      localStorage.setItem('agentstudio-selected-model', id);
    } catch {
      // localStorage unavailable — routing falls back to the default key
    }
  }, []);

  // 模型选择的单一事实源：UI 生效模型（selectedModel 或 recent 回退）必须在
  // 提交前同步到 localStorage，否则 chatActions.resolveKey 读到 null → 默认
  // key（历史上"一直走 deepseek"的根因之一：UI 显示选了模型但请求走默认）。
  const ensureModelPersisted = useCallback(() => {
    const effective = effectiveSelectedModel;
    if (effective) {
      try {
        localStorage.setItem('agentstudio-selected-model', effective);
      } catch {
        // non-fatal
      }
    }
  }, [effectiveSelectedModel]);
  const hasMessages = apiMessages.length > 0;
  const convRef = useRef(conv);
  useEffect(() => {
    convRef.current = conv;
  });
  // Conversation that owns the currently running run — sync must write back to
  // it even if the user switches away mid-run, never to the newly active one.
  const runConvIdRef = useRef<string | null>(null);
  // 加载竞态保护：快速切换分支时，丢弃过期响应（仅最新一次落地）。
  const loadSeqRef = useRef(0);
  // 分支切换（切版本/切分支）时抑制自动滚动 — 不主动滚到底部；
  // 视觉位置由浏览器 scroll anchoring 保持（与 DeepSeek 一致：切换时
  // 正在看的消息/按钮保持在视口原位）。流式输出/首屏才跟随底部。
  const suppressScrollRef = useRef(false);
  // 自动跟随滚动：模型输出时滚到底；用户手动滚动离开底部则暂停跟随
  // （停留用户位置），滚回底部后恢复。
  const followBottomRef = useRef(true);
  const programmaticScrollRef = useRef(false);

  // Persist in-flight store messages into a conversation. Must run BEFORE a
  // switch takes effect (while the store still holds the old run's messages).
  const syncActiveConversation = useCallback((convId?: string) => {
    const targetId = convId ?? convRef.current.activeConvId;
    if (!targetId) return;
    const state = useChatStore.getState();
    if (state.messages.length > 0) {
      convRef.current.updateConversationMessages(targetId, state.messages, false, activeTeamId ?? undefined, activeTeamName);
    }
    if (state.currentSessionId) {
      convRef.current.updateConversationSessionId(targetId, state.currentSessionId, false);
    }
    runConvIdRef.current = null;
  }, [activeTeamId, activeTeamName, convRef]);

  const lastMsgLen = apiMessages.length;
  const lastMsgStream = useMemo(() => {
    const m = apiMessages[apiMessages.length - 1];
    if (!m) return '';
    return `${m.thinking ?? ''}|${m.content ?? ''}`;
  }, [apiMessages]);

  useEffect(() => {
    if (abandonedRunId) {
      toast(t('toast.requestAbandoned'), 'info');
    }
  }, [abandonedRunId, toast, t]);

  // 用户手动滚动 → 更新是否跟随底部（程序滚动由 programmaticScrollRef 跳过）。
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        return;
      }
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      if (atBottom !== followBottomRef.current) followBottomRef.current = atBottom;
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [messagesContainerRef]);

  const prevLenRef = useRef(lastMsgLen);
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // 分支切换后消息列表重建 — 不主动滚动。浏览器 scroll anchoring
    // 会把正在查看的消息/按钮保持在原视口位置。
    if (suppressScrollRef.current) {
      suppressScrollRef.current = false;
      return;
    }
    const lenChanged = lastMsgLen !== prevLenRef.current;
    prevLenRef.current = lastMsgLen;
    // 新增消息（发送/切换/加载）→ 无条件跟随；流式增量 → 仅在用户位于
    // 底部时跟随（用户上滚看历史时暂停，不强制拉回）。
    if (!lenChanged && !followBottomRef.current) return;
    programmaticScrollRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
  }, [lastMsgLen, lastMsgStream, messagesContainerRef]);

  // Sync messages back to conversation when run completes (status idle)
  // OR when WebSocket disconnects — covers the case where the 'result'
  // event is lost and apiStatus stays at 'running'.
  useEffect(() => {
    if (apiStatus === 'loading') return;
    if (apiStatus === 'running' && wsStatus !== 'disconnected') return;

    syncActiveConversation(runConvIdRef.current ?? undefined);
  }, [apiMessages, apiStatus, wsStatus, syncActiveConversation]);

  useEffect(() => {
    const activeId = activeConvId;
    if (!activeId) {
      useChatStore.getState().reset();
      return;
    }
    // setTimeout 延后一帧：restoring 的同步 setState 移出 effect 体
    // （react-hooks/set-state-in-effect），快速切换由 timer cleanup 兜底。
    const timer = setTimeout(() => {
      setRestoring(true);
      // 切换会话 → 恢复自动跟随滚动（新会话重新滚到底部）。
      followBottomRef.current = true;
      // 立即清空旧会话消息，避免旧消息残留到新会话加载完成才跳变（视觉跳动）。
      useChatStore.getState().clearMessages(activeId);
      const found = filteredConversations.find((c) => c.id === activeId);
      if (!found) { resetApi(); setRestoring(false); return; }

    const loadSnapshot = () => {
      const chatMessages: import('../../types').ChatMessage[] = found.messages.map((m, idx) => ({
        id: typeof m.id === 'number' ? `${activeId}-${idx}` : m.id,
        role: m.role === 'user' ? 'user' : 'agent',
        agent_name: m.agentId ?? (m.role === 'user' ? '我' : 'Agent'),
        content: m.content,
        thinking: m.thinking ?? undefined,
        thinkingDone: m.thinkingDone === true || Boolean(m.thinking && !m.interrupted),
        versions: m.versions ?? undefined,
        currentVersion: m.currentVersion ?? undefined,
        thumbsFeedback: m.thumbsFeedback ?? undefined,
        interrupted: m.interrupted ?? undefined,
        round_number: 0,
        created_at: m.timestamp
          ? new Date(m.timestamp).toISOString()
          : Reflect.get(m, 'created_at')
            ? String(Reflect.get(m, 'created_at'))
            : found.createdAt && found.updatedAt && found.messages.length > 0
              ? new Date(
                  new Date(found.createdAt).getTime() +
                  (new Date(found.updatedAt).getTime() - new Date(found.createdAt).getTime()) *
                  ((idx + 0.5) / found.messages.length)
                ).toISOString()
              : null,
      }));
      const current = useChatStore.getState().messages;
      for (const msg of chatMessages) {
        if (!msg.thinking) {
          const live = current.find((c) => c.content === msg.content && c.role === msg.role);
          if (live?.thinking) msg.thinking = live.thinking;
        }
        if (!msg.versions) {
          const live = current.find((c) => c.content === msg.content && c.role === msg.role);
          if (live?.versions) { msg.versions = live.versions; msg.currentVersion = live.currentVersion; }
        }
        if (!msg.thumbsFeedback) {
          const live = current.find((c) => c.content === msg.content && c.role === msg.role);
          if (live?.thumbsFeedback) msg.thumbsFeedback = live.thumbsFeedback;
        }
        if (!msg.thinkingDone) {
          const live = current.find((c) => c.content === msg.content && c.role === msg.role);
          if (live?.thinkingDone) msg.thinkingDone = true;
        }
      }
      loadConversation(chatMessages, found.id, found.sessionId);
    };

    // Backend is the source of truth for session-backed conversations: always
    // re-fetch so fresh data (thinking included) wins over stale localStorage
    // snapshots. Local-only UI state (versions/thumbs/interrupted) is overlaid
    // from the snapshot; on API failure/empty, fall back to the snapshot.
    if (found.sessionId) {
      let cancelled = false;
      // 切换即时性（stale-while-revalidate）：先渲染本地快照（localStorage，
      // 毫秒级），网络详情返回后再覆盖 — 避免每次切换等待后端 RTT 的空白。
      if (found.messages.length > 0) {
        loadSnapshot();
      } else {
        resetApi();
      }
      getSessionDetail(found.sessionId).then((detail) => {
        if (cancelled) return;
        // 与 handleSwitchBranch 同形：buildRunPath 取目标分支父链（首屏 = 最新
        // run），buildPathTurns 平铺消息并挂载分支版本（answerVersions/answerRunIds
        // 等）— 模型答案分页器首屏即可见，无需先切一次分支。
        const runs = detail.runs ?? [];
        // 刷新/重进会话时恢复切换过的分支：优先用存储的 runId（buildRunPath
        // 父链 + active=该 run），无存储则默认最新 run。
        const branchKey = `agentstudio-branch:${found.sessionId}`;
        let storedRunId: string | null = null;
        try { storedRunId = localStorage.getItem(branchKey); } catch { /* non-fatal */ }
        const fromRunId =
          storedRunId && runs.some((r) => r.id === storedRunId)
            ? storedRunId
            : null;
        const { path, active } = buildRunPath(runs, fromRunId);
        const loaded = buildPathTurns(path, runs);
        // Persisted messages are completed turns — mark agent thinking as done
        // so the ThinkingSection shows "已思考" instead of a stuck spinner.
        for (const m of loaded) {
          if (m.role !== 'user' && m.thinkingDone === undefined) {
            m.thinkingDone = true;
          }
          const raw = m as unknown as Record<string, unknown>;
          const thinkingVersions = raw.thinking_versions as string[] | undefined;
          if (thinkingVersions && thinkingVersions.length > 0) {
            m.thinkingVersions = thinkingVersions;
          }
        }
        if (loaded.length > 0) {
          const snapshot = found.messages || [];
          for (const m of loaded) {
            const local = snapshot.find((lm) => lm.content === m.content && (lm.role === 'user') === (m.role === 'user'));
            if (!local) continue;
            // buildPathTurns 分支版本（userVersions/versionRunIds）优先；本地快照
            // 仅补齐 UI-only 状态（thumbs/interrupted）与服务端缺失的编辑版本。
            m.versions = local.versions ?? m.versions;
            m.thinkingVersions = local.thinkingVersions ?? m.thinkingVersions;
            m.userVersions = m.userVersions ?? local.userVersions;
            m.currentVersion = local.currentVersion ?? m.currentVersion;
            m.currentUserVersion = m.currentUserVersion ?? local.currentUserVersion;
            m.thumbsFeedback = local.thumbsFeedback ?? undefined;
            m.interrupted = local.interrupted ?? undefined;
            m.thinkingDone = local.thinkingDone === true || Boolean(m.thinking && !m.interrupted);
          }
          conv.updateConversationMessages(activeId, loaded as unknown as import('../../types/AgentStudio').Message[], false);
          loadConversation(loaded, found.id, found.sessionId);
          // currentRunId 设为路径末端（首屏 = 最新 run），后续追问挂到当前
          // 显示分支（与 handleSwitchBranch 的 setState 行为一致）。
          useChatStore.setState({ currentRunId: active, activeRunId: active });
          setRestoring(false);
        } else if (found.messages.length > 0) {
          loadSnapshot();
          setRestoring(false);
        } else {
          resetApi();
          setRestoring(false);
        }
      }).catch(() => {
        if (found.messages.length > 0) loadSnapshot();
        else resetApi();
        setRestoring(false);
      });
      return () => { cancelled = true; };
    }

    if (found.messages.length === 0) { resetApi(); setRestoring(false); return; }
    loadSnapshot();
    setRestoring(false);
    }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId]);

  const handleNewChat = useCallback(() => {
    syncActiveConversation();
    resetApi();
    setSelectedAgentId(null);
    useChatStore.getState().setActiveTeam(null);
    conv.setActiveConvId(null);
    setRestoring(false);
    navigate('/');
    setConversationKey((prev) => prev + 1);
  }, [syncActiveConversation, conv, resetApi, navigate]);

  // 退出登录：重置模型选择并回首页（登出已清 store/localStorage，这里清
  // 组件内 useState — '/' 与 '/chat/:id' 同组件，navigate 不会卸载重置；
  // models/keys 查询缓存也移除，游客态不再复用登录用户的模型列表）。
  const queryClient = useQueryClient();
  useEffect(() => {
    const onLogout = () => {
      setSelectedModelState('');
      queryClient.removeQueries({ queryKey: ['models'] });
      queryClient.removeQueries({ queryKey: ['keys'] });
      navigate('/');
    };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, [queryClient, navigate]);

  // 会话导航（对齐 ragbase/DeepSeek URL 语义）：点击会话/新建会话 →
  // navigate 驱动 URL，activeConvId 由 useParams 派生。agent/team 身份
  // 状态（selectedAgentId/activeTeamId）保持 state 语义，不 URL 化。
  const navigateToConversation = useCallback((convId: string | null) => {
    // 按会话自身身份恢复/清除 agent/team 状态，避免团队身份残留导致
    // 普通会话消息被渲染成团队消息（见 MessagesPanel TeamMessage 分支）。
    // convId 为 null（新建聊天/团队入口）时由调用方管理身份，此处不动。
    if (convId) {
      const target = conv.conversations.find((c) => c.id === convId);
      const teamId = target?.kind === 'team' ? target.teamId : undefined;
      const agentId = target?.kind === 'agent' ? target.agentId : undefined;
      useChatStore.getState().setActiveTeam(teamId ?? null);
      setSelectedAgentId(agentId ?? null);
    }
    conv.setActiveConvId(convId);
    if (convId) {
      setRestoring(true);
      navigate(`/chat/${convId}`);
    } else {
      setRestoring(false);
      navigate('/');
    }
  }, [conv, navigate, setSelectedAgentId]);

  // 直达主页（无 URL 会话）时恢复上次会话：localStorage fallback 后
  // 以 URL 形式重建（replace，不堆历史）。
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem('agentstudio-active-conv-id'); } catch { /* non-fatal */ }
    if (!sessionId && stored) {
      navigate(`/chat/${stored}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 分支语义：切版本 = 切分支，视图整体切到目标 run 所在分支的全部消息
  // （父链 + 子孙链，后续轮次跟随目标分支；不在该分支的轮次仅视图隐藏，DB 留存）。
  const handleSwitchBranch = useCallback(async (runId: string) => {
    // currentSessionId 即当前会话 id（loadConversation 与流式提交均设置）。
    const convId = useChatStore.getState().currentSessionId;
    if (!convId) return;
    // 分支切换 = 用户主动操作 — 抑制自动滚动，视觉位置由浏览器
    // scroll anchoring 保持。
    suppressScrollRef.current = true;
    const seq = ++loadSeqRef.current;
    try {
      const detail = await getSessionDetail(convId);
      if (seq !== loadSeqRef.current) return;
      const currentPath = new Set(
        useChatStore
          .getState()
          .messages.map((m) => m.runId)
          .filter((id): id is string => !!id),
      );
      const path = buildBranchPath(detail.runs ?? [], runId, currentPath);
      const loaded = buildPathTurns(path, detail.runs ?? []);
      for (const m of loaded) {
        if (m.role !== 'user' && m.thinkingDone === undefined) {
          m.thinkingDone = true;
        }
      }
      useChatStore.getState().loadConversation(loaded, convId, convId);
      // currentRunId 设为加载分支的末端（buildBranchPath 可能经 tail 选择了
      // 平行分支），后续追问才挂到当前显示的分支而非传入的父节点。
      // activeRunId 同步 — 续聊依赖它挂父链（祖先链上下文注入）。
      useChatStore.setState({
        currentRunId: path[path.length - 1]?.id ?? runId,
        activeRunId: path[path.length - 1]?.id ?? runId,
      });
      // 记住当前分支，刷新/重进会话时恢复同一视图。
      try {
        localStorage.setItem(
          `agentstudio-branch:${convId}`,
          path[path.length - 1]?.id ?? runId,
        );
      } catch { /* non-fatal */ }
      Logger.info(
        '[switchBranch] run=%s runs=%d path=%d loaded=%d',
        runId.slice(0, 8),
        (detail.runs ?? []).length,
        path.length,
        loaded.length,
      );
    } catch (err) {
      Logger.warn('[useWorkstationState] failed to switch branch to %s', runId, err);
    }
  }, []);

  // 附件链路：InputToolbar 选中即传（后端 pre-session 解耦），这里只把已
  // 上传的 attachment id 随消息提交；run 创建时后端绑定到 session/run。
  const attachmentIdsOf = useCallback((files: AttachedFile[]): string[] | undefined => {
    const ids = files.map((f) => f.attachmentId).filter((x): x is string => !!x);
    return ids.length > 0 ? ids : undefined;
  }, []);

  const handleSendMessage = useCallback(
    async (text: string, files: AttachedFile[]) => {
      ensureModelPersisted();
      const userMessage: import('../../types/AgentStudio').Message = {
        id: crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        attachments: files
          .filter((f) => f.attachmentId)
          .map((f) => ({ id: f.attachmentId as string, filename: f.name, size_bytes: f.size })),
      };
      if (!conv.activeConvId) {
        const tName = teamMgmt.teams.find(t => t.id === activeTeamId)?.name;
        const kind: 'agent' | 'team' | 'normal' = selectedAgentId ? 'agent' : activeTeamId ? 'team' : 'normal';
        const convId = conv.saveConversation(text, [userMessage], selectedAgentId ?? undefined, activeTeamId ?? undefined, tName, kind);
        if (convId) { conv.setActiveConvId(convId); runConvIdRef.current = convId; useChatStore.setState({ currentConvId: convId }); navigate(`/chat/${convId}`); }
      } else {
        runConvIdRef.current = conv.activeConvId;
        // 续聊：把用户消息追加到当前会话，避免历史里只剩第一条用户消息
        const activeConv = conv.conversations.find((c) => c.id === conv.activeConvId);
        const prevMessages = activeConv?.messages ?? [];
        conv.updateConversationMessages(conv.activeConvId, [...prevMessages, userMessage], true, activeTeamId ?? undefined, activeTeamName);
        const st = useChatStore.getState();
        useChatStore.setState({ messages: [...st.messages, {
          id: userMessage.id, role: userMessage.role, agent_name: '我',
          content: userMessage.content, round_number: 0, created_at: new Date().toISOString(),
        }] });
      }
      window.dispatchEvent(new CustomEvent('clear-browser-url'));
      submitToApi(text, undefined, selectedAgentId ?? undefined, true, undefined, undefined, undefined, attachmentIdsOf(files)).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [submitToApi, selectedAgentId, notify, conv, activeTeamId, activeTeamName, teamMgmt.teams, navigate, attachmentIdsOf, ensureModelPersisted],
  );

  const handleHomeSend = useCallback(
    async (text: string, files: AttachedFile[]) => {
      ensureModelPersisted();
      const userMessage: import('../../types/AgentStudio').Message = {
        id: crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10)),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        attachments: files
          .filter((f) => f.attachmentId)
          .map((f) => ({ id: f.attachmentId as string, filename: f.name, size_bytes: f.size })),
      };
      const homeKind: 'agent' | 'team' | 'normal' = selectedAgentId ? 'agent' : 'normal';
      if (!conv.activeConvId) {
        const convId = conv.saveConversation(text, [userMessage], selectedAgentId ?? undefined, undefined, undefined, homeKind);
        if (convId) { conv.setActiveConvId(convId); runConvIdRef.current = convId; useChatStore.setState({ currentConvId: convId }); navigate(`/chat/${convId}`); }
      } else {
        runConvIdRef.current = conv.activeConvId;
        const activeConv = conv.conversations.find((c) => c.id === conv.activeConvId);
        const prevMessages = activeConv?.messages ?? [];
        conv.updateConversationMessages(conv.activeConvId, [...prevMessages, userMessage], true);
        const st = useChatStore.getState();
        useChatStore.setState({ messages: [...st.messages, {
          id: userMessage.id, role: userMessage.role, agent_name: '我',
          content: userMessage.content, round_number: 0, created_at: new Date().toISOString(),
        }] });
      }
      // saveConversation + setActiveConvId → useEffect loads msg into store → skip duplicate
      submitToApi(text, undefined, undefined, true, undefined, undefined, undefined, attachmentIdsOf(files)).catch(() => {
        Logger.warn('API submission failed');
      });
      notify();
    },
    [conv, submitToApi, notify, selectedAgentId, navigate, attachmentIdsOf, ensureModelPersisted],
  );

  const { isPageDragOver, handlePageDragOver, handlePageDragLeave, handlePageDrop } = useDragAndDrop(inputToolbarRef as React.RefObject<InputToolbarHandle>);

  const toggleWorkspaceFullscreen = useCallback(async () => {
    if (!workspaceRef.current) return;
    try {
      if (!document.fullscreenElement) await workspaceRef.current.requestFullscreen();
      else await document.exitFullscreen();
    } catch { /* ignore */ }
  }, [workspaceRef]);

  const handleSaveAgent = useCallback(
    async (agent: Agent) => {
      try {
        const { updateAgent, createAgent } = await import('../../api/client/agents');
        const cfg = {
          name: agent.name,
          system_prompt: agent.systemPrompt || '',
          output_constraints: agent.outputConstraints || undefined,
          tools: agent.tools || undefined,
          mcp: agent.mcp || undefined,
          skills: agent.skills || undefined,
        };
        const oldId = agent.id;
        try {
          await updateAgent(oldId, cfg);
        } catch (updateErr: unknown) {
          const ue = updateErr as { response?: { status?: number }; status?: number };
          if (ue.response?.status === 404 || ue.status === 404) {
            const created = await createAgent({
              ...cfg,
              role_identifier: 'agent_' + (crypto.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).substring(2, 10))).slice(0, 8),
              order: 0, is_active: false, is_approver: false, icon: '🤖',
            });
            const team = teamMgmt.teams.find((t) => t.agents.some((a) => a.id === oldId));
            agent.id = created.id;
            teamMgmt.replaceAgentId(oldId, created.id);
            if (team) void teamMgmt.linkMemberAgent(team.id, oldId, created.id);
          } else { throw updateErr; }
        }
        setConfiguringAgent(null);
        toast(t('toast.saveSuccess'), 'success');
      } catch {
        toast(t('toast.saveFailed'), 'error');
      }
    },
    [teamMgmt, toast, t],
  );

  const currentSessionId = useChatStore((s) => s.currentSessionId);

  const handleExecuteCommand = useCallback(
    async (cmd: string) => {
      if (!currentSessionId) return;
      try {
        const result = await executeCommand(cmd, currentSessionId);
        if (result.success) {
          toast(result.message, 'success');
          conv.setConversations([...conv.conversations]);
        } else {
          toast(result.message, 'error');
        }
      } catch {
        toast(t('toast.error'), 'error');
      }
    },
    [currentSessionId, toast, t, conv],
  );

  const displayMessages: Message[] = useMemo(
    () =>
      apiMessages.map((m) => ({
        id: m.id,
        role: m.role === 'user' ? 'user' : 'agent',
        agentId: m.role,
        content: m.content,
        thinking: m.thinking,
        thinkingDone: m.thinkingDone === true,
        timestamp: m.created_at ? new Date(m.created_at).getTime() : 0,
        versions: m.versions,
        currentVersion: m.currentVersion,
        userVersions: m.userVersions,
        currentUserVersion: m.currentUserVersion,
        answerVersions: m.answerVersions,
        currentAnswerVersion: m.currentAnswerVersion,
        thumbsFeedback: m.thumbsFeedback,
        interrupted: m.interrupted,
        attachments: m.attachments,
      })),
    [apiMessages],
  );

  const handleCloseAgentConfig = useCallback(() => setConfiguringAgent(null), []);
  const handleCloseSettings = useCallback(() => setIsSettingsOpen(false), []);
  const handleCloseApi = useCallback(() => setIsApiOpen(false), []);
  const handleCloseConfirm = useCallback(() => setConfirmDialog(null), []);
  const handleCloseNewProject = useCallback(() => setIsNewProjectOpen(false), []);

  const allCommands = useMemo(
    () => [...(apiCommands || []), ...agentCommands],
    [apiCommands, agentCommands],
  );

  const allAgents = teamMgmt.allAgents;

  return {

    toast,
    t,
    notify,
    teamMgmt,
    conv,
    apiCommands,
    models,
    agentCommands,
    apiMessages,
    apiStatus,
    apiError,
    wsStatus,
    submitToApi,
    resetApi,
    cancelRun,
    retryApi,
    loadConversation,
    abandonedRunId,
    selectedAgentId,
    setSelectedAgentId,
    configuringAgent,
    setConfiguringAgent,
    isUserMenuOpen,
    setIsUserMenuOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isApiOpen,
    setIsApiOpen,
    isSidebarOpen,
    setIsSidebarOpen,
    welcomeDismissed,
    setWelcomeDismissed,
    isNewProjectOpen,
    setIsNewProjectOpen,
    confirmDialog,
    setConfirmDialog,
    conversationKey,
    setConversationKey,
    isWorkspaceOpen,
    setIsWorkspaceOpen,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    selectedModel,
    setSelectedModel,
    isWorkstationOpen,
    setIsWorkstationOpen,
    settings,
    updateSettings,
    isDarkMode,
    activeTeamId,
    activeTeamName,
    showAgentChat,
    activeConvId,
    navigateToConversation,
    filteredConversations,
    effectiveSelectedModel,
    // activeConvId 非空（URL 指向会话）→ 恒显示消息面板：加载中 restoring
    // 保真，空会话（runs 为空）也停驻空面板而非回弹主页。
    hasMessages: hasMessages || restoring || activeConvId !== null,
    isPageDragOver,
    handlePageDragOver,
    handlePageDragLeave,
    handlePageDrop,
    toggleWorkspaceFullscreen,
    handleNewChat,
    handleSwitchBranch,
    syncActiveConversation,
    handleSendMessage,
    handleHomeSend,
    handleSaveAgent,
    handleExecuteCommand,
    handleCloseAgentConfig,
    handleCloseSettings,
    handleCloseApi,
    handleCloseConfirm,
    handleCloseNewProject,
    displayMessages,
    allCommands,
    allAgents,
  };
}
