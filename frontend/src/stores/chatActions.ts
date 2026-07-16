import type { ChatMessage } from '../types';
import { connectRun, disconnectRun } from '../api/websocket';
import { submitRequirement as submitRequirementExternal, resumeRun, listKeys } from '../api/client';
import Logger from '../utils/logger';
import { uid } from './uid';
import { createStreamHandler } from './chatStreaming';
import { useChatStore } from './chatStore';

export async function submitRequirement(
  requirement: string,
  session_id?: string,
  agent_id?: string,
  skipAddUserMessage?: boolean,
  submissionConvId?: string | null,
) {
  const s = useChatStore.getState();
  const effectiveSessionId = session_id || s.currentSessionId || undefined;
  if (s.currentRunId) {
    disconnectRun(s.currentRunId);
  }
  useChatStore.setState({ submissionConvId: submissionConvId ?? null });

  let keyId: string | undefined;
  let model: string | undefined;
  try {
    const keys = await listKeys();
    const defaultKey = keys.find((k) => k.is_default && k.is_active) || keys.find((k) => k.is_active);
    if (defaultKey) {
      keyId = defaultKey.id;
      const persistedModel = localStorage.getItem('devagents-selected-model');
      model = (persistedModel && defaultKey.models.includes(persistedModel))
        ? persistedModel
        : defaultKey.models[0];
    }
  } catch {
    // Key vault unavailable
  }

  if (!keyId) {
    useChatStore.setState({ status: 'error', error: '请先在设置中配置 API Key', wsStatus: 'disconnected' });
    return;
  }

  const userMsg: ChatMessage = {
    id: uid(),
    role: 'user',
    agent_name: '我',
    content: requirement,
    round_number: 0,
    created_at: new Date().toISOString(),
  };

  useChatStore.setState({
    status: 'loading',
    error: null,
    result: null,
    messages: skipAddUserMessage ? useChatStore.getState().messages : [...useChatStore.getState().messages, userMsg],
    currentRole: null,
  });

  try {
    const currentState = useChatStore.getState();
    const teamId = currentState.activeTeamId ?? undefined;
    Logger.info('[chat] submitRequirement — team_id=%s | agent_id=%s | session_id=%s', teamId, agent_id, effectiveSessionId);
    const resp = await submitRequirementExternal(requirement, effectiveSessionId, keyId, model, agent_id, teamId);
    const run_id = resp.run_id;
    const returnedSessionId = resp.session_id || effectiveSessionId || null;
    useChatStore.setState({ currentRunId: run_id, currentSessionId: returnedSessionId, status: 'running', wsStatus: 'connecting' });
    connectRun(run_id, { onMessage: createStreamHandler(useChatStore.setState, useChatStore.getState) });
  } catch (err: any) {
    Logger.error('[chat] submitRequirement failed:', err);
    useChatStore.setState({ status: 'error', error: err?.message || String(err) });
  }
}

export function editMessage(msgIndex: number, newContent: string) {
  useChatStore.setState((s) => {
    const updated = [...s.messages];
    const msg = { ...updated[msgIndex], content: newContent };
    updated[msgIndex] = msg;
    return { messages: updated };
  });
}

export async function regenerateMessage(msgIndex: number) {
  const s = useChatStore.getState();
  Logger.info('[chat] regenerateMessage — from index %d', msgIndex);
  if (msgIndex < 1) return;
  const userMsg = s.messages[msgIndex - 1];
  if (!userMsg) return;
  if (s.currentRunId) disconnectRun(s.currentRunId);
  useChatStore.setState({ status: 'loading', error: null, result: null, messages: s.messages.slice(0, msgIndex) });
  await submitRequirement(userMsg.content, s.currentSessionId ?? undefined, undefined, true);
}

export async function retry() {
  const s = useChatStore.getState();
  Logger.info('[chat] retry — re-submitting last user message');
  useChatStore.setState({ status: 'loading', error: null, result: null });
  if (s.currentRunId) {
    disconnectRun(s.currentRunId);
  }
  const lastUserMsg = [...s.messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) {
    useChatStore.setState({ status: 'error', error: '没有找到用户消息，无法重试' });
    return;
  }
  useChatStore.setState({ currentRunId: null });
  try {
    const resp = await submitRequirementExternal(lastUserMsg.content, s.currentSessionId ?? undefined);
    useChatStore.setState({ currentRunId: resp.run_id, currentSessionId: resp.session_id || s.currentSessionId || null, status: 'running', wsStatus: 'connecting' });
    connectRun(resp.run_id, { onMessage: createStreamHandler(useChatStore.setState, useChatStore.getState) });
  } catch (err: any) {
    Logger.error('[chat] retry failed:', err);
    useChatStore.setState({ status: 'error', error: err?.message || String(err) });
  }
}

export async function continueGeneration() {
  const s = useChatStore.getState();
  const intId = s.interruptedMessageId;
  if (!intId) return;
  const idx = s.messages.findIndex((m) => m.id === intId);
  if (idx < 0) {
    useChatStore.setState({ interruptedMessageId: null });
    return;
  }
  Logger.info('[chat] continueGeneration — continuing from interrupted msg %s', intId);
  const interruptedMsg = s.messages[idx];
  useChatStore.setState({
    continuingId: intId,
    skipThinking: false,
    pendingVersions: interruptedMsg.versions || [interruptedMsg.content],
    pendingThinkingVersions: interruptedMsg.thinkingVersions?.length ? interruptedMsg.thinkingVersions : (interruptedMsg.thinking ? [interruptedMsg.thinking] : null),
  });
  const continuation = interruptedMsg.content;
  const prevRunId = s.currentRunId;
  if (prevRunId) disconnectRun(prevRunId);
  useChatStore.setState({ status: 'loading', error: null, result: null });
  try {
    const resp = await resumeRun(continuation, s.currentSessionId || undefined, interruptedMsg.thinking);
    const run_id = resp.run_id;
    const returnedSessionId = resp.session_id || s.currentSessionId || null;
    useChatStore.setState({ currentRunId: run_id, currentSessionId: returnedSessionId, status: 'running', wsStatus: 'connecting' });
    connectRun(run_id, { onMessage: createStreamHandler(useChatStore.setState, useChatStore.getState) });
  } catch (err: any) {
    Logger.error('[chat] continueGeneration failed:', err);
    useChatStore.setState({ status: 'error', error: err?.message || String(err) });
  }
}
