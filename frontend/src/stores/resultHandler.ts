import Logger from '../utils/logger';
import { uid } from './uid';
import { updateAnswerVersions } from '../api/client/sessions';
import type { ChatState } from './chatTypes';
import type { ChatMessage, RunResult } from '../types';

function makeRunResult(code: string): RunResult {
  return { code, requirement: '', pm_document: '', review: '', approved: false, status: 'completed' };
}
import type { WsThinkingDoneEvent, WsResultEvent, WsTeamResultEvent, WsThumbsEvent } from './wsEvents';

type SetFn = (fn: (state: ChatState) => Partial<ChatState>) => void;
type GetFn = () => ChatState;

export function handleThinkingDone(s: ChatState, msg: WsThinkingDoneEvent): Partial<ChatState> {
  const continuingId = s.continuingId;
  const pending = s.pendingVersions;
  const pendingThinking = s.pendingThinkingVersions;
  if (!continuingId) {
    return {};
  }
  Logger.warn('[chat] continue thinking_done — no streamingId; falling back to direct replacement (continuingId=%s)', continuingId);
  const contIdx = s.messages.findIndex((m) => m.id === continuingId);
  const oldMsg = contIdx >= 0 ? s.messages[contIdx] : null;
  const oldContent = oldMsg?.content || '';
  const oldThinking = oldMsg?.thinking || '';
  const base = contIdx >= 0 ? s.messages.slice(0, contIdx) : s.messages.filter((m) => m.id !== continuingId);
  const newId = crypto.randomUUID?.() || uid();
  const newVersions = pending ? [...pending] : undefined;
  const newThinkingVersions = pendingThinking ? [...pendingThinking] : undefined;
  if (newVersions && newVersions.length > 0) {
    newVersions[newVersions.length - 1] = oldContent;
  }
  if (newThinkingVersions && newThinkingVersions.length > 0) {
    newThinkingVersions[newThinkingVersions.length - 1] = msg.thinking || oldThinking;
  }
  return {
    streamingId: newId,
    continuingId: null,
    pendingVersions: null,
    pendingThinkingVersions: null,
    messages: [
      ...base,
      {
        id: newId,
        role: 'agent',
        agent_name: oldMsg?.agent_name || msg.agent_name || 'Agent',
        content: oldContent,
        thinking: msg.thinking || oldThinking,
        round_number: 0,
        created_at: new Date().toISOString(),
        versions: newVersions,
        thinkingVersions: newThinkingVersions,
        currentVersion: newVersions ? newVersions.length - 1 : undefined,
      },
    ],
    currentRole: msg.agent_name || 'Agent',
    wsStatus: 'connected' as ChatState['wsStatus'],
  };
}

export function handleThinkingDoneEvent(set: SetFn, msg: WsThinkingDoneEvent): void {
  set((s) => {
    if (s.streamingId) {
      return {
        messages: s.messages.map((m) =>
          m.id === s.streamingId
            ? {
                ...m,
                thinkingDone: true,
                ...(msg.thinking ? { thinking: msg.thinking } : {}),
              }
            : m,
        ),
      };
    }
    return handleThinkingDone(s, msg);
  });
}

export function handleResultEvent(
  set: SetFn,
  get: GetFn,
  activeStreamMsgIds: Set<string>,
  msg: WsResultEvent,
): void {
  const runId = get().currentRunId;
  const streamMsgId = get().streamingId;
    const codeContent: string = msg.code ? String(msg.code) : '';
  set((_s) => {
    let msgs = _s.messages;
    if (_s.streamingId) {
      msgs = _s.messages.map((m) => {
        if (m.id !== _s.streamingId) return m;
        const updated: Record<string, unknown> = {};
        if (codeContent) updated.content = codeContent;
        if (m.thinking === '') updated.thinking = undefined;
        return { ...m, ...updated, thinkingDone: true } as ChatMessage;
      });
    }
    // 重新生成完成：给新模型消息挂答案分页（同 requirement 答案组 =
    // 旧 run 列表 + 新 run），切换走分支加载（父链 + 子孙链）。
    let pendingRegenerate = _s.pendingRegenerate;
    const done = msgs.find((m) => m.id === _s.streamingId);
    if (done && pendingRegenerate && runId) {
      const answerRunIds = [...pendingRegenerate.oldRunIds, runId];
      msgs = msgs.map((m) =>
        m.id === done.id
          ? {
              ...m,
              userMsgId: pendingRegenerate!.userMsgId,
              answerVersions: answerRunIds.map(
                () => pendingRegenerate!.requirement,
              ),
              answerRunIds,
              currentAnswerVersion: answerRunIds.length - 1,
            }
          : m,
      );
      pendingRegenerate = null;
    }
    return {
      messages: msgs,
      pendingRegenerate,
      status: 'idle' as ChatState['status'],
      streamingId: null,
      result: makeRunResult(codeContent),
      skipThinking: false,
    };
  });
  // Edit-regenerate: persist the merged answer versions so they survive a reload.
  if (streamMsgId && runId) {
    const done = get().messages.find((m) => m.id === streamMsgId);
    if (done && done.versions && done.versions.length > 0) {
      updateAnswerVersions(runId, done.versions, done.thinkingVersions).catch((err) => {
        Logger.warn('[chat] failed to persist answer versions for run %s: %s', runId, String(err));
      });
    }
  }
  Logger.info('[chat] result received — status set to idle');
  activeStreamMsgIds.delete(runId || '');
}

export function handleTeamResultEvent(
  set: SetFn,
  get: GetFn,
  activeStreamMsgIds: Set<string>,
  msg: WsTeamResultEvent,
): void {
  const runId = get().currentRunId;
  const display = typeof msg.display === 'string' && msg.display.trim() ? msg.display : '';
  const artifactCount = msg.artifacts && typeof msg.artifacts === 'object' && !Array.isArray(msg.artifacts)
    ? Object.keys(msg.artifacts).length
    : 0;
  set((_s) => {
    let msgs = _s.messages;
    if (_s.streamingId) {
      const streamed = _s.messages.find((m) => m.id === _s.streamingId);
      const verdictFor = streamed
        ? msg.verdicts?.[streamed.agent_name || ''] ?? undefined
        : undefined;
      if (verdictFor) {
        // Reviewer：verdict 人类可读化，保留角色消息（行业化布局——
        // 评审是角色自己的输出，不并入团队汇总）。
        const score = typeof verdictFor.score === 'number'
          ? ` · score ${verdictFor.score}`
          : '';
        const head = `${verdictFor.approved ? '✅ 通过' : '❌ 未通过'}${score}`;
        const reason = verdictFor.reason ? `\n理由：${verdictFor.reason}` : '';
        msgs = _s.messages.map((m) =>
          m.id === _s.streamingId
            ? { ...m, thinkingDone: true, content: `${head}${reason}` } as ChatMessage
            : m,
        );
        // 追加「团队汇总」最终成品（reporter 交付物）
        if (display) {
          msgs = [
            ...msgs,
            {
              id: crypto.randomUUID?.() || uid(),
              role: 'agent',
              agent_name: '团队汇总',
              content: display,
              round_number: 1,
              created_at: new Date().toISOString(),
            } as ChatMessage,
          ];
        }
      } else {
        // Generator：最后一条流消息升级为「团队汇总」最终成品
        msgs = _s.messages.map((m) => {
          if (m.id !== _s.streamingId) return m;
          const updated: Record<string, unknown> = { thinkingDone: true };
          if (display) {
            updated.content = display;
            updated.agent_name = '团队汇总';
          }
          return { ...m, ...updated } as ChatMessage;
        });
      }
    }
    // 重新生成完成：给新模型消息挂答案分页（同 requirement 答案组 =
    // 旧 run 列表 + 新 run），切换走分支加载（父链 + 子孙链）。
    // 与 handleResultEvent 保持一致——否则 team 会话重新生成后分页
    // 箭头要等刷新（buildPathTurns 从 DB 挂载）才出现。
    let pendingRegenerate = _s.pendingRegenerate;
    const done = msgs.find((m) => m.id === _s.streamingId);
    if (done && pendingRegenerate && runId) {
      const answerRunIds = [...pendingRegenerate.oldRunIds, runId];
      msgs = msgs.map((m) =>
        m.id === done.id
          ? {
              ...m,
              userMsgId: pendingRegenerate!.userMsgId,
              answerVersions: answerRunIds.map(
                () => pendingRegenerate!.requirement,
              ),
              answerRunIds,
              currentAnswerVersion: answerRunIds.length - 1,
            }
          : m,
      );
      pendingRegenerate = null;
    }
    return {
      messages: msgs,
      pendingRegenerate,
      status: 'idle' as ChatState['status'],
      streamingId: null,
      skipThinking: false,
    };
  });
  Logger.info('[chat] team_result received — surfaced %d node artifacts, status set to idle', artifactCount);
  activeStreamMsgIds.delete(runId || '');
}

export function handleThumbsEvent(set: SetFn, msg: WsThumbsEvent): void {
  set((s) => ({
    messages: s.messages.map((m) =>
      m.id === msg.msgId ? { ...m, thumbs: msg.value } : m,
    ),
  }));
}
