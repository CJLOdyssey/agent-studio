import type { ChatState } from './chatTypes';
import type { WsEvent } from './wsEvents';
import { disconnectRun } from '../api/websocket';
import { handleStreamEvent, handleThinkingStreamEvent, handleTeamResultMeta, handleApprovalRequest } from './streamHandler';
import { handleMessageEvent, handleInfoEvent, handleErrorEvent, handleBalanceWarningEvent, handleOpenUrlEvent } from './messageHandler';
import { handleThinkingDoneEvent, handleResultEvent, handleTeamResultEvent, handleThumbsEvent } from './resultHandler';

type SetFn = (fn: (state: ChatState) => Partial<ChatState>) => void;
type GetFn = () => ChatState;

const _activeStreamMsgIds = new Set<string>();

export function createStreamHandler(set: SetFn, get: GetFn) {
  return (data: unknown) => {
    const msg = data as WsEvent;

    if (msg.type === 'stream') {
      handleStreamEvent(set, get, _activeStreamMsgIds, msg);
      return;
    }

    if (msg.type === 'thinking_stream') {
      handleThinkingStreamEvent(set, get, _activeStreamMsgIds, msg);
      return;
    }

    if (msg.type === 'message') {
      handleMessageEvent(set, msg);
      return;
    }

    if (msg.type === 'thinking_done') {
      handleThinkingDoneEvent(set, msg);
      return;
    }

    if (msg.type === 'info') {
      handleInfoEvent(set, msg);
      return;
    }

    if (msg.type === 'error') {
      handleErrorEvent(set, msg);
      // 后端 error 路径不发 result：run 已终止，必须显式断开 WS，否则
      // onclose 自动重连 + drain_buffer 回放重复，且服务端 subscribe_run/
      // Redis pubsub 连接挂到 idle 超时（泄漏）。
      const runId = get().currentRunId;
      if (runId) disconnectRun(runId);
      return;
    }

    if (msg.type === 'balance_warning') {
      handleBalanceWarningEvent(set, msg);
      const runId = get().currentRunId;
      if (runId) disconnectRun(runId);
      return;
    }

    if (msg.type === 'open_url') {
      handleOpenUrlEvent(msg);
      return;
    }

    if (msg.type === 'result') {
      handleResultEvent(set, get, _activeStreamMsgIds, msg);
      return;
    }

    if (msg.type === 'team_result') {
      handleTeamResultEvent(set, get, _activeStreamMsgIds, msg);
      handleTeamResultMeta(set, msg);
      return;
    }

    if (msg.type === 'approval_request') {
      handleApprovalRequest(set, msg);
      return;
    }

    if (msg.type === 'thumbs') {
      handleThumbsEvent(set, msg);
    }
  };
}
