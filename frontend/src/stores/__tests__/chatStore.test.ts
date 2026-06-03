import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentConfig, AppStatus } from '../../types';

vi.mock('../../api/websocket', () => ({
  connectRun: vi.fn(() => vi.fn()),
  disconnectRun: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  submitRequirement: vi.fn(),
  listAgents: vi.fn(),
  listKeys: vi.fn().mockResolvedValue([{ id: 'key-1', is_default: true, is_active: true, models: ['deepseek-chat'] }]),
}));

const initialState = {
  currentRunId: null,
  currentSessionId: null,
  messages: [],
  status: 'idle' as AppStatus,
  result: null,
  currentRole: null,
  error: null,
  agents: [],
  agentsLoaded: false,
  wsStatus: 'disconnected' as const,
};

beforeEach(async () => {
  const { useChatStore } = await import('../chatStore');
  useChatStore.setState(initialState);
});

describe('chatStore', () => {
  it('初始状态正确', async () => {
    const { useChatStore } = await import('../chatStore');
    const state = useChatStore.getState();
    expect(state.currentRunId).toBeNull();
    expect(state.currentSessionId).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.status).toBe('idle');
    expect(state.result).toBeNull();
    expect(state.currentRole).toBeNull();
    expect(state.error).toBeNull();
    expect(state.agents).toEqual([]);
    expect(state.agentsLoaded).toBe(false);
    expect(state.wsStatus).toBe('disconnected');
  });

  it('setStatus 更新状态', async () => {
    const { useChatStore } = await import('../chatStore');
    const store = useChatStore.getState();
    store.setStatus('loading');
    expect(useChatStore.getState().status).toBe('loading');
    store.setStatus('running');
    expect(useChatStore.getState().status).toBe('running');
    store.setStatus('completed');
    expect(useChatStore.getState().status).toBe('completed');
    store.setStatus('error');
    expect(useChatStore.getState().status).toBe('error');
  });

  it('setResult 存储结果', async () => {
    const { useChatStore } = await import('../chatStore');
    const result = { requirement: 'test', pm_document: 'doc', code: 'code', review: 'review', approved: true, status: 'converged' };
    useChatStore.getState().setResult(result);
    expect(useChatStore.getState().result).toEqual(result);
  });

  it('setError 设置和清除错误', async () => {
    const { useChatStore } = await import('../chatStore');
    useChatStore.getState().setError('出错了');
    expect(useChatStore.getState().error).toBe('出错了');
    useChatStore.getState().setError(null);
    expect(useChatStore.getState().error).toBeNull();
  });

  it('setWsStatus 更新 WebSocket 连接状态', async () => {
    const { useChatStore } = await import('../chatStore');
    useChatStore.getState().setWsStatus('connecting');
    expect(useChatStore.getState().wsStatus).toBe('connecting');
    useChatStore.getState().setWsStatus('connected');
    expect(useChatStore.getState().wsStatus).toBe('connected');
    useChatStore.getState().setWsStatus('reconnecting');
    expect(useChatStore.getState().wsStatus).toBe('reconnecting');
    useChatStore.getState().setWsStatus('disconnected');
    expect(useChatStore.getState().wsStatus).toBe('disconnected');
  });

  describe('addMessage', () => {
    it('添加消息到消息列表', async () => {
      const { useChatStore } = await import('../chatStore');
      useChatStore.getState().addMessage({ type: 'message', role: 'pm', agent_name: 'PM', content: '测试' });
      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('pm');
      expect(state.messages[0].content).toBe('测试');
      expect(state.currentRole).toBe('pm');
    });

    it('添加多条消息递增列表', async () => {
      const { useChatStore } = await import('../chatStore');
      useChatStore.getState().addMessage({ type: 'message', role: 'pm', agent_name: 'PM', content: 'msg1' });
      useChatStore.getState().addMessage({ type: 'message', role: 'dev', agent_name: 'DEV', content: 'msg2' });
      expect(useChatStore.getState().messages).toHaveLength(2);
    });
  });

  it('reset 重置所有状态包括 wsStatus', async () => {
    const { useChatStore } = await import('../chatStore');
    useChatStore.getState().setStatus('running');
    useChatStore.getState().setError('error');
    useChatStore.getState().setWsStatus('connected');
    useChatStore.getState().reset();
    const state = useChatStore.getState();
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.result).toBeNull();
    expect(state.wsStatus).toBe('disconnected');
  });

  describe('loadAgents', () => {
    it('成功加载代理列表', async () => {
      const mockAgents: AgentConfig[] = [
        { id: '1', name: 'PM', role_identifier: 'pm', system_prompt: 'prompt', model: null, temperature: null, order: 1, is_active: true, is_approver: false, icon: '📋', created_at: null },
      ];
      const client = await import('../../api/client');
      (client.listAgents as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgents);
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().loadAgents();
      const state = useChatStore.getState();
      expect(state.agents).toEqual(mockAgents);
      expect(state.agentsLoaded).toBe(true);
    });

    it('加载失败时 agentsLoaded 仍为 true', async () => {
      const client = await import('../../api/client');
      (client.listAgents as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().loadAgents();
      expect(useChatStore.getState().agentsLoaded).toBe(true);
    });
  });

  describe('submitRequirement', () => {
    it('提交需求时添加用户消息到列表', async () => {
      const client = await import('../../api/client');
      (client.submitRequirement as ReturnType<typeof vi.fn>).mockResolvedValue({ run_id: 'run-1', status: 'running' });
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().submitRequirement('测试需求');
      const state = useChatStore.getState();
      expect(state.status).toBe('running');
      expect(state.currentRunId).toBe('run-1');
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[0].agent_name).toBe('我');
      expect(state.messages[0].content).toBe('测试需求');
      expect(state.error).toBeNull();
    });

    it('提交失败时保留用户消息并设置 wsStatus 为 disconnected', async () => {
      const client = await import('../../api/client');
      (client.submitRequirement as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API Error'));
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().submitRequirement('test');
      const state = useChatStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('API Error');
      expect(state.wsStatus).toBe('disconnected');
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('user');
    });

    it('无可用 API Key 时返回引导提示', async () => {
      const client = await import('../../api/client');
      (client.submitRequirement as ReturnType<typeof vi.fn>).mockClear();
      (client.listKeys as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().submitRequirement('测试需求');
      const state = useChatStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('请先在设置中配置 API Key');
      expect(state.wsStatus).toBe('disconnected');
      // BYOK: should NOT call the API when no key is configured
      expect(client.submitRequirement).not.toHaveBeenCalled();
    });
  });
});
