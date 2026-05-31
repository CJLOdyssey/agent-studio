import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentConfig, AppStatus } from '../../types';

vi.mock('../../api/websocket', () => ({
  connectRun: vi.fn(() => vi.fn()),
  disconnectRun: vi.fn(),
}));

vi.mock('../../api/client', () => ({
  submitRequirement: vi.fn(),
  listAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  toggleAgent: vi.fn(),
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

  it('reset 重置所有状态', async () => {
    const { useChatStore } = await import('../chatStore');
    useChatStore.getState().setStatus('running');
    useChatStore.getState().setError('error');
    useChatStore.getState().reset();
    const state = useChatStore.getState();
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
    expect(state.messages).toEqual([]);
    expect(state.result).toBeNull();
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
      const promise = useChatStore.getState().submitRequirement('测试需求');
      const loadingState = useChatStore.getState();
      expect(loadingState.status).toBe('loading');
      expect(loadingState.messages).toHaveLength(1);
      expect(loadingState.messages[0].role).toBe('user');
      expect(loadingState.messages[0].agent_name).toBe('我');
      expect(loadingState.messages[0].content).toBe('测试需求');
      await promise;
      const state = useChatStore.getState();
      expect(state.status).toBe('running');
      expect(state.currentRunId).toBe('run-1');
      expect(state.messages).toHaveLength(1);
      expect(state.error).toBeNull();
    });

    it('提交失败时保留用户消息', async () => {
      const client = await import('../../api/client');
      (client.submitRequirement as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API Error'));
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().submitRequirement('test');
      const state = useChatStore.getState();
      expect(state.status).toBe('error');
      expect(state.error).toBe('API Error');
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].role).toBe('user');
    });
  });

  describe('agent CRUD', () => {
    it('createAgent 调用 API 并刷新列表', async () => {
      const client = await import('../../api/client');
      (client.createAgent as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-id' });
      (client.listAgents as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().createAgent({ name: 'A', role_identifier: 'a', system_prompt: 'p', order: 1, is_active: true, is_approver: false, icon: '◆' });
      expect(client.createAgent).toHaveBeenCalled();
    });

    it('updateAgent 调用 API', async () => {
      const client = await import('../../api/client');
      (client.updateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().updateAgent('1', { name: 'new' });
      expect(client.updateAgent).toHaveBeenCalledWith('1', { name: 'new' });
    });

    it('deleteAgent 调用 API', async () => {
      const client = await import('../../api/client');
      (client.deleteAgent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().deleteAgent('1');
      expect(client.deleteAgent).toHaveBeenCalledWith('1');
    });

    it('toggleAgent 调用 API', async () => {
      const client = await import('../../api/client');
      (client.toggleAgent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      const { useChatStore } = await import('../chatStore');
      await useChatStore.getState().toggleAgent('1');
      expect(client.toggleAgent).toHaveBeenCalledWith('1');
    });
  });
});
