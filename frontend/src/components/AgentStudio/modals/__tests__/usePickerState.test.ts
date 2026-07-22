import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePickerState } from '../tabs/usePickerState';

vi.mock('../../workstation/prompt/api', () => ({
  promptAPI: {
    fetchAll: vi.fn().mockResolvedValue([
      { id: 'p1', name: 'Prompt 1', content: 'Hello' },
      { id: 'p2', name: 'Prompt 2', content: 'World' },
    ]),
  },
}));

vi.mock('../../workstation/output/api', () => ({
  outputAPI: {
    fetchAll: vi.fn().mockResolvedValue([
      { id: 'o1', name: 'Output 1', content: 'Constraint A' },
    ]),
  },
}));

vi.mock('../../workstation/tool/api', () => ({
  toolAPI: {
    fetchAll: vi.fn().mockResolvedValue([
      { id: 't1', name: 'Tool 1', description: 'A tool' },
    ]),
  },
}));

vi.mock('../../workstation/mcp/api', () => ({
  mcpAPI: {
    fetchAll: vi.fn().mockResolvedValue([
      { id: 'm1', name: 'MCP 1', description: 'An MCP' },
    ]),
  },
}));

vi.mock('../../workstation/skill/api', () => ({
  skillAPI: {
    fetchAll: vi.fn().mockResolvedValue([
      { id: 's1', name: 'Skill 1', description: 'A skill' },
    ]),
  },
}));

describe('usePickerState', () => {
  const deps = {
    setSystemPrompt: vi.fn(),
    setOutputConstraints: vi.fn(),
    addTool: vi.fn(),
    addMcp: vi.fn(),
    addSkill: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches all picker items on mount', async () => {
    const { result } = renderHook(() => usePickerState(deps));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.pickerItems.system).toHaveLength(2);
    expect(result.current.pickerItems.output).toHaveLength(1);
    expect(result.current.pickerItems.tools).toHaveLength(1);
    expect(result.current.pickerItems.mcp).toHaveLength(1);
    expect(result.current.pickerItems.skills).toHaveLength(1);
  });

  it('handlePickerSelect for system appends to prompt', async () => {
    const { result } = renderHook(() => usePickerState(deps));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const item = { id: 'p1', name: 'Prompt', description: 'content' };
    act(() => result.current.handlePickerSelect('system', item));
    expect(deps.setOutputConstraints).not.toHaveBeenCalled();
    expect(result.current.pickerTab).toBeNull();
  });

  it('handlePickerSelect for output appends to constraints', async () => {
    const { result } = renderHook(() => usePickerState(deps));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const item = { id: 'o1', name: 'Output', description: 'constraint text' };
    act(() => result.current.handlePickerSelect('output', item));
    expect(deps.setOutputConstraints).toHaveBeenCalled();
  });

  it('handlePickerSelect for tools calls addTool', async () => {
    const { result } = renderHook(() => usePickerState(deps));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const item = { id: 't1', name: 'Tool', description: '' };
    act(() => result.current.handlePickerSelect('tools', item));
    expect(deps.addTool).toHaveBeenCalledWith(item);
  });

  it('handlePickerSelect for mcp calls addMcp', async () => {
    const { result } = renderHook(() => usePickerState(deps));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const item = { id: 'm1', name: 'MCP', description: '' };
    act(() => result.current.handlePickerSelect('mcp', item));
    expect(deps.addMcp).toHaveBeenCalledWith(item);
  });

  it('handlePickerSelect for skills calls addSkill', async () => {
    const { result } = renderHook(() => usePickerState(deps));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const item = { id: 's1', name: 'Skill', description: '' };
    act(() => result.current.handlePickerSelect('skills', item));
    expect(deps.addSkill).toHaveBeenCalledWith(item);
  });

  it('setPickerTab works', async () => {
    const { result } = renderHook(() => usePickerState(deps));
    act(() => result.current.setPickerTab('system'));
    expect(result.current.pickerTab).toBe('system');
  });

  it('cancels fetch on unmount', async () => {
    const { unmount } = renderHook(() => usePickerState(deps));
    unmount();
  });
});
