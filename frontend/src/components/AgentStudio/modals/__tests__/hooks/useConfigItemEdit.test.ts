import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('../../../workstation/tool/api', () => ({
  toolAPI: { create: vi.fn().mockResolvedValue({}) },
}));

import { useConfigItemEdit } from '../../tabs/useConfigItemEdit';
import type { AgentTool, AgentMCP, AgentSkill } from '../../../../../types/AgentStudio';

function makeItemList<T>() {
  let items: T[] = [];
  let editingId: string | null = null;
  return {
    get items() { return items; },
    setItems: (v: T[]) => { items = v; },
    get editingId() { return editingId; },
    setEditingId: (id: string | null) => { editingId = id; },
    addCustom: vi.fn((fn: () => T) => { items.push(fn()); }),
    update: vi.fn((id: string, updates: Partial<T>) => {}),
    remove: vi.fn((id: string) => {}),
  };
}

function makeForm() {
  const state = {
    tool: { show: false, data: { name: '', description: '', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.0.0', endpoint: '', parameters: '' }, errors: [] as string[] },
    mcp: { show: false, data: { name: '', description: '', type: 'stdio', status: 'disconnected', version: 'v1.0.0', command: '', url: '' }, errors: [] as string[] },
    skill: { show: false, data: { name: '', description: '', category: 'AI/ML', status: 'available', version: 'v1.0.0', author: '', instructions: '', prompt_id: '', tool_names: [], output_constraint: '' }, errors: [] as string[] },
  };
  return {
    forms: state,
    openForm: vi.fn((kind: 'tool' | 'mcp' | 'skill') => { state[kind].show = true; }),
    closeForm: vi.fn((kind: 'tool' | 'mcp' | 'skill') => { state[kind].show = false; }),
    updateFormData: vi.fn((kind: 'tool' | 'mcp' | 'skill', fn: (d: unknown) => unknown) => {}),
    setFormErrors: vi.fn((kind: 'tool' | 'mcp' | 'skill', errors: string[]) => { state[kind].errors = errors; }),
  };
}

describe('useConfigItemEdit', () => {
  it('returns editing state initialized to null', () => {
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      makeForm(),
    ));
    expect(result.current.editingToolItem).toBeNull();
    expect(result.current.editingMcpItem).toBeNull();
    expect(result.current.editingSkillItem).toBeNull();
  });

  it('itemsToFormData converts Record to ToolFormData', () => {
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      makeForm(),
    ));
    const fd = result.current.itemsToFormData({ name: 'MyTool', description: 'A tool', category: 'dev', parameters: '{}' });
    expect(fd.name).toBe('MyTool');
    expect(fd.description).toBe('A tool');
    expect(fd.category).toBe('dev');
  });

  it('handleFormClose closes all forms and clears editing state', () => {
    const form = makeForm();
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.setEditingToolItem({ id: 't1' } as AgentTool));
    act(() => result.current.handleFormClose());
    expect(result.current.editingToolItem).toBeNull();
    expect(form.closeForm).toHaveBeenCalledWith('tool');
  });

  it('handleEditTool opens form with tool data', () => {
    const form = makeForm();
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.handleEditTool({ name: 'Tool1', description: 'desc', version: 'v1.0.0', parameters: '{}' }));
    expect(result.current.editingToolItem).not.toBeNull();
    expect(form.openForm).toHaveBeenCalledWith('tool');
  });

  it('handleEditMcp opens form with mcp data', () => {
    const form = makeForm();
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.handleEditMcp({ name: 'MCP1', description: 'mcp desc', type: 'stdio', command: 'npx start' }));
    expect(result.current.editingMcpItem).not.toBeNull();
    expect(form.openForm).toHaveBeenCalledWith('mcp');
  });

  it('handleEditSkill opens form with skill data', () => {
    const form = makeForm();
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.handleEditSkill({ name: 'Skill1', description: 'skill desc' }));
    expect(result.current.editingSkillItem).not.toBeNull();
    expect(form.openForm).toHaveBeenCalledWith('skill');
  });

  it('saveFormItem with empty name sets errors', () => {
    const form = makeForm();
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.saveFormItem('tool'));
    expect(form.setFormErrors).toHaveBeenCalled();
  });

  it('saveFormItem with valid name creates tool via addCustom', () => {
    const tools = makeItemList<AgentTool>();
    const form = makeForm();
    form.forms.tool.data = { name: 'NewTool', description: 'desc', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.0.0', endpoint: '', parameters: '' };
    const { result } = renderHook(() => useConfigItemEdit(
      tools,
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.saveFormItem('tool'));
    expect(tools.addCustom).toHaveBeenCalled();
  });

  it('saveFormItem with existing tool calls update', () => {
    const tools = makeItemList<AgentTool>();
    const form = makeForm();
    form.forms.tool.data = { name: 'UpdatedTool', description: 'desc', category: '自定义工具', model: 'GPT-4o', status: 'active', version: 'v1.0.0', endpoint: '', parameters: '{}' };
    const { result } = renderHook(() => useConfigItemEdit(
      tools,
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.setEditingToolItem({ id: 'edit-1', name: 'Old', description: 'old', enabled: true } as AgentTool));
    act(() => result.current.saveFormItem('tool'));
    expect(tools.update).toHaveBeenCalledWith('edit-1', expect.any(Object));
    expect(result.current.editingToolItem).toBeNull();
  });

  it('saveFormItem with valid name creates mcp via addCustom', () => {
    const mcp = makeItemList<AgentMCP>();
    const form = makeForm();
    form.forms.mcp.data = { name: 'NewMCP', description: 'mcp desc', type: 'stdio', command: 'npx start', url: '' };
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      mcp,
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.saveFormItem('mcp'));
    expect(mcp.addCustom).toHaveBeenCalled();
  });

  it('saveFormItem with existing mcp calls update', () => {
    const mcp = makeItemList<AgentMCP>();
    const form = makeForm();
    form.forms.mcp.data = { name: 'UpdatedMCP', description: 'updated', type: 'stdio', command: 'npx', url: '' };
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      mcp,
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.setEditingMcpItem({ id: 'mcp-1', name: 'Old', description: 'old', enabled: true } as AgentMCP));
    act(() => result.current.saveFormItem('mcp'));
    expect(mcp.update).toHaveBeenCalledWith('mcp-1', expect.any(Object));
    expect(result.current.editingMcpItem).toBeNull();
  });

  it('saveFormItem with valid name creates skill via addCustom', () => {
    const skills = makeItemList<AgentSkill>();
    const form = makeForm();
    form.forms.skill.data = { name: 'NewSkill', description: 'skill desc', category: 'AI/ML', status: 'available', version: 'v1.0.0', author: '', instructions: '', prompt_id: '', tool_names: [], output_constraint: '' };
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      skills,
      form,
    ));
    act(() => result.current.saveFormItem('skill'));
    expect(skills.addCustom).toHaveBeenCalled();
  });

  it('saveFormItem with existing skill calls update', () => {
    const skills = makeItemList<AgentSkill>();
    const form = makeForm();
    form.forms.skill.data = { name: 'UpdatedSkill', description: 'updated', category: 'AI/ML', status: 'available', version: 'v1.0.0', author: '', instructions: '', prompt_id: '', tool_names: [], output_constraint: '' };
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      skills,
      form,
    ));
    act(() => result.current.setEditingSkillItem({ id: 'skill-1', name: 'Old', description: 'old', enabled: true } as AgentSkill));
    act(() => result.current.saveFormItem('skill'));
    expect(skills.update).toHaveBeenCalledWith('skill-1', expect.any(Object));
    expect(result.current.editingSkillItem).toBeNull();
  });

  it('saveFormItem with empty name for mcp sets errors', () => {
    const form = makeForm();
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.saveFormItem('mcp'));
    expect(form.setFormErrors).toHaveBeenCalledWith('mcp', expect.any(Array));
  });

  it('saveFormItem with empty name for skill sets errors', () => {
    const form = makeForm();
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.saveFormItem('skill'));
    expect(form.setFormErrors).toHaveBeenCalledWith('skill', expect.any(Array));
  });

  it('handleFormClose clears all editing states', () => {
    const form = makeForm();
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      form,
    ));
    act(() => result.current.setEditingToolItem({ id: 't1' } as AgentTool));
    act(() => result.current.setEditingMcpItem({ id: 'm1' } as AgentMCP));
    act(() => result.current.setEditingSkillItem({ id: 's1' } as AgentSkill));
    act(() => result.current.handleFormClose());
    expect(result.current.editingToolItem).toBeNull();
    expect(result.current.editingMcpItem).toBeNull();
    expect(result.current.editingSkillItem).toBeNull();
    expect(form.closeForm).toHaveBeenCalled();
  });

  it('itemsToFormData handles missing fields', () => {
    const { result } = renderHook(() => useConfigItemEdit(
      makeItemList<AgentTool>(),
      makeItemList<AgentMCP>(),
      makeItemList<AgentSkill>(),
      makeForm(),
    ));
    const fd = result.current.itemsToFormData({});
    expect(fd.name).toBe('');
    expect(fd.category).toBe('自定义工具');
    expect(fd.model).toBe('GPT-4o');
    expect(fd.status).toBe('active');
    expect(fd.version).toBe('v1.0.0');
  });
});
