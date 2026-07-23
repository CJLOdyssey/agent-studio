import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentManagement } from '../useAgentManagement';

vi.mock('../api', () => ({
  agentAPI: {
    fetchAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    clone: vi.fn(),
    removeBatch: vi.fn(),
  },
}));

import { agentAPI } from '../api';

const MOCK_AGENTS: any[] = [
  { id: '1', name: '前端开发 Agent', description: '前端开发', team: '前端团队', model: 'Claude Sonnet 4', status: 'running', version: 'v2.1.0', systemPromptId: 'p1', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-10' },
  { id: '2', name: '后端开发 Agent', description: '后端开发', team: '后端团队', model: 'GPT-4o', status: 'stopped', version: 'v1.8.3', systemPromptId: 'p2', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-12' },
  { id: '3', name: '测试 Agent', description: '自动化测试', team: '质量团队', model: 'Gemini 2.5 Pro', status: 'stopped', version: 'v1.5.0', systemPromptId: 'p3', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-05-20' },
];

describe('useAgentManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (agentAPI.fetchAll as ReturnType<typeof vi.fn>).mockResolvedValue([...MOCK_AGENTS]);
    (agentAPI.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new_1', name: 'New Agent', description: '', team: '前端团队', model: 'GPT-4o', status: 'stopped', version: 'v1.0.0', systemPromptId: '', toolIds: [], mcpIds: [], skillIds: [], createdAt: '2026-06-01' });
    (agentAPI.remove as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (agentAPI.clone as ReturnType<typeof vi.fn>).mockResolvedValue({ id: '1_copy', ...MOCK_AGENTS[0], name: '前端开发 Agent (副本)' });
    (agentAPI.removeBatch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('loads data on mount', async () => {
    const { result } = renderHook(() => useAgentManagement());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds agent via handleSave', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.openCreate(); });
    act(() => { result.current.setFormData({ name: 'Test Agent', description: '', team: '前端团队', model: 'GPT-4o', status: 'stopped', version: 'v1.0.0', systemPromptId: 'agent-prompt-1', toolIds: [], mcpIds: [], skillIds: [] }); });
    act(() => { result.current.handleSave(); });
    await waitFor(() => expect(agentAPI.create).toHaveBeenCalled());
  });

  it('copies an agent', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.handleCopy(MOCK_AGENTS[0]); });
    await waitFor(() => expect(agentAPI.clone).toHaveBeenCalled());
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('前端'); });
    await waitFor(() => expect(result.current.processed.every((a: any) => a.name.includes('前端') || a.team.includes('前端') || a.model.includes('前端'))).toBe(true));
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
  });

  it('blocks deletion of a running agent', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const running = MOCK_AGENTS[0]; // status: running
    act(() => { result.current.openDelete(running); });
    expect(result.current.batchError).toContain('不可删除');
  });

  it('opens delete for non-running agent', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.openDelete(MOCK_AGENTS[1]); });
    expect(result.current.isDeleteOpen).toBe(true);
  });

  it('batchError auto-clears after timeout', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    vi.useFakeTimers();
    act(() => { result.current.openDelete(MOCK_AGENTS[0]); });
    expect(result.current.batchError).not.toBe('');
    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current.batchError).toBe('');
    vi.useRealTimers();
  });

  it('opens batch delete when no running agents selected', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.toggleSelect(MOCK_AGENTS[1].id); }); // stopped
    act(() => { result.current.openBatchDelete(); });
    expect(result.current.isBatchDeleteOpen).toBe(true);
  });

  it('blocks batch delete when running agents selected', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.toggleSelect(MOCK_AGENTS[0].id); }); // running
    act(() => { result.current.openBatchDelete(); });
    expect(result.current.batchError).toContain('不可删除');
  });

  it('performs batch delete', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.toggleSelect(MOCK_AGENTS[1].id); });
    act(() => { result.current.openBatchDelete(); });
    act(() => { result.current.handleBatchDelete(); });
    await waitFor(() => expect(agentAPI.removeBatch).toHaveBeenCalled());
  });

  it('sets status filter', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setStatusFilter('running'); });
    expect(result.current.statusFilter).toBe('running');
    act(() => { result.current.setStatusFilter('all'); });
    expect(result.current.statusFilter).toBe('all');
  });

  it('handleSort sorts by field', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.handleSort('name'); });
    expect(result.current.sortField).toBe('name');
    const firstDir = result.current.sortDir;
    act(() => { result.current.handleSort('name'); });
    expect(result.current.sortDir).not.toBe(firstDir);
  });

  it('toggle selection', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.toggleSelect('1'); });
    expect(result.current.selectedIds.has('1')).toBe(true);
    act(() => { result.current.toggleSelectAll(); });
    expect(result.current.allOnPageSelected).toBe(true);
    act(() => { result.current.setSelectedIds(new Set(['1', '2'])); });
    expect(result.current.selectedIds.has('1')).toBe(true);
    expect(result.current.selectedIds.has('2')).toBe(true);
  });

  it('openHistory opens history modal', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.openHistory(MOCK_AGENTS[0]); });
    expect(result.current.isHistoryOpen).toBe(true);
  });

  it('setIs modal closers', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setIsFormOpen(false); });
    expect(result.current.isFormOpen).toBe(false);
    act(() => { result.current.setIsDeleteOpen(false); });
    expect(result.current.isDeleteOpen).toBe(false);
    act(() => { result.current.setIsBatchDeleteOpen(false); });
    expect(result.current.isBatchDeleteOpen).toBe(false);
    act(() => { result.current.setIsHistoryOpen(false); });
    expect(result.current.isHistoryOpen).toBe(false);
  });

  it('setFormData replaces formData', async () => {
    const { result } = renderHook(() => useAgentManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.openCreate(); });
    act(() => { result.current.setFormData({ name: 'Replaced', description: 'desc', team: '前端团队', model: 'GPT-4o', status: 'stopped', version: 'v1.0.0', systemPromptId: '', toolIds: [], mcpIds: [], skillIds: [] }); });
    expect(result.current.formData.name).toBe('Replaced');
  });
});
