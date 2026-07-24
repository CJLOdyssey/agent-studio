import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgentConfigForm } from '../../tabs/useAgentConfigForm';

describe('useAgentConfigForm', { tags: ['integration'] }, () => {
  it('initializes with all forms hidden', () => {
    const { result } = renderHook(() => useAgentConfigForm());
    expect(result.current.forms.tool.show).toBe(false);
    expect(result.current.forms.mcp.show).toBe(false);
    expect(result.current.forms.skill.show).toBe(false);
  });

  it('openForm shows form with default data and clears errors', () => {
    const { result } = renderHook(() => useAgentConfigForm());
    act(() => result.current.setFormErrors('tool', ['error']));
    act(() => result.current.openForm('tool'));
    expect(result.current.forms.tool.show).toBe(true);
    expect(result.current.forms.tool.errors).toEqual([]);
    expect(result.current.forms.tool.data.name).toBe('');
  });

  it('closeForm hides form and clears errors', () => {
    const { result } = renderHook(() => useAgentConfigForm());
    act(() => result.current.openForm('mcp'));
    act(() => result.current.setFormErrors('mcp', ['err']));
    act(() => result.current.closeForm('mcp'));
    expect(result.current.forms.mcp.show).toBe(false);
    expect(result.current.forms.mcp.errors).toEqual([]);
  });

  it('updateFormData updates data for specified kind', () => {
    const { result } = renderHook(() => useAgentConfigForm());
    act(() => result.current.openForm('skill'));
    act(() => result.current.updateFormData('skill', (d: Record<string, unknown>) => ({ ...d, name: 'Test Skill' })));
    expect(result.current.forms.skill.data.name).toBe('Test Skill');
  });

  it('setFormErrors sets error messages', () => {
    const { result } = renderHook(() => useAgentConfigForm());
    act(() => result.current.setFormErrors('tool', ['Name required', 'Version invalid']));
    expect(result.current.forms.tool.errors).toEqual(['Name required', 'Version invalid']);
  });

  it('independent forms do not interfere', () => {
    const { result } = renderHook(() => useAgentConfigForm());
    act(() => result.current.openForm('tool'));
    act(() => result.current.updateFormData('tool', (d: Record<string, unknown>) => ({ ...d, name: 'MyTool' })));
    expect(result.current.forms.mcp.data.name).toBe('');
    expect(result.current.forms.tool.data.name).toBe('MyTool');
  });
});
