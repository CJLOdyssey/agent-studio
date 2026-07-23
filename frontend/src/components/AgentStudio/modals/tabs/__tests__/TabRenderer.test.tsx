import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../SystemPromptTab', () => ({
  SystemPromptTab: vi.fn(({ value, onChange, onAddFromWorkstation }) => (
    <div data-testid="system-prompt-tab">
      <span data-testid="system-value">{value}</span>
      <button data-testid="system-add" onClick={onAddFromWorkstation}>Add</button>
      <textarea data-testid="system-textarea" onChange={(e) => onChange(e.target.value)} />
    </div>
  )),
}));

vi.mock('../OutputConstraintTab', () => ({
  OutputConstraintTab: vi.fn(({ value, onChange, onAddFromWorkstation }) => (
    <div data-testid="output-constraint-tab">
      <span data-testid="output-value">{value}</span>
      <button data-testid="output-add" onClick={onAddFromWorkstation}>Add</button>
      <textarea data-testid="output-textarea" onChange={(e) => onChange(e.target.value)} />
    </div>
  )),
}));

vi.mock('../ToolsTab', () => ({
  ToolsTab: vi.fn(({ items, onEditFull, onCustomize }: any) => (
    <div data-testid="tools-tab">
      {items.map((item: any) => <span key={item.id} data-testid="tool-item">{item.name}</span>)}
      {onEditFull && <button data-testid="tool-edit-full" onClick={() => onEditFull({ id: 't1' })}>Edit Full</button>}
      {onCustomize && <button data-testid="tool-customize" onClick={onCustomize}>Customize</button>}
    </div>
  )),
}));

vi.mock('../MCPTab', () => ({
  MCPTab: vi.fn(({ items, onEditFull, onCustomize }: any) => (
    <div data-testid="mcp-tab">
      {items.map((item: any) => <span key={item.id} data-testid="mcp-item">{item.name}</span>)}
      {onEditFull && <button data-testid="mcp-edit-full" onClick={() => onEditFull({ id: 'm1' })}>Edit Full</button>}
      {onCustomize && <button data-testid="mcp-customize" onClick={onCustomize}>Customize</button>}
    </div>
  )),
}));

vi.mock('../SkillsTab', () => ({
  SkillsTab: vi.fn(({ items, onEditFull, onCustomize }: any) => (
    <div data-testid="skills-tab">
      {items.map((item: any) => <span key={item.id} data-testid="skill-item">{item.name}</span>)}
      {onEditFull && <button data-testid="skill-edit-full" onClick={() => onEditFull({ id: 's1' })}>Edit Full</button>}
      {onCustomize && <button data-testid="skill-customize" onClick={onCustomize}>Customize</button>}
    </div>
  )),
}));

vi.mock('../../ItemEditor', () => ({
  default: vi.fn(({ kind, children }) => (
    <div data-testid={`item-editor-${kind}`}>{children}</div>
  )),
}));

import TabRenderer from '../TabRenderer';
import type { TabRendererProps } from '../TabRenderer';
import type { AgentTool, AgentMCP, AgentSkill } from '../../../../../types/AgentStudio';

function makeListShape<T>(items: T[] = []) {
  return {
    items,
    editingId: null as string | null,
    setEditingId: vi.fn(),
    toggle: vi.fn(),
    addCustom: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };
}

const defaultForm = {
  forms: {
    tool: { show: false, data: { name: '', description: '', parameters: '' } as any, errors: [] as string[] },
    mcp: { show: false, data: { name: '', description: '' } as any, errors: [] as string[] },
    skill: { show: false, data: { name: '', description: '' } as any, errors: [] as string[] },
  },
  openForm: vi.fn(),
  closeForm: vi.fn(),
  updateFormData: vi.fn(),
};

function baseProps(overrides: Partial<TabRendererProps> = {}): TabRendererProps {
  return {
    activeTab: 'system',
    systemRef: { current: null },
    outputRef: { current: null },
    systemPrompt: '',
    onSystemPromptChange: vi.fn(),
    outputConstraints: '',
    onOutputConstraintsChange: vi.fn(),
    tools: makeListShape<AgentTool>(),
    mcp: makeListShape<AgentMCP>(),
    skills: makeListShape<AgentSkill>(),
    form: defaultForm,
    editingToolItem: null,
    editingMcpItem: null,
    editingSkillItem: null,
    onSaveFormItem: vi.fn(),
    onFormClose: vi.fn(),
    onSetEditingMcpItem: vi.fn(),
    onSetEditingSkillItem: vi.fn(),
    onEditTool: vi.fn(),
    onEditMcp: vi.fn(),
    onEditSkill: vi.fn(),
    onPickerOpen: vi.fn(),
    itemsToFormData: vi.fn() as any,
    ...overrides,
  };
}

describe('TabRenderer', () => {
  it('renders SystemPromptTab when activeTab is "system"', () => {
    render(<TabRenderer {...baseProps()} />);
    expect(screen.getByTestId('system-prompt-tab')).toBeInTheDocument();
  });

  it('passes systemPrompt value to SystemPromptTab', () => {
    render(<TabRenderer {...baseProps({ systemPrompt: 'Hello World' })} />);
    expect(screen.getByTestId('system-value').textContent).toBe('Hello World');
  });

  it('renders SystemPromptTab with onChange handler', () => {
    const onSystemPromptChange = vi.fn();
    render(<TabRenderer {...baseProps({ onSystemPromptChange })} />);
    expect(screen.getByTestId('system-prompt-tab')).toBeInTheDocument();
    expect(onSystemPromptChange).not.toHaveBeenCalled();
  });

  it('calls onPickerOpen("system") when system add button clicked', () => {
    const onPickerOpen = vi.fn();
    render(<TabRenderer {...baseProps({ onPickerOpen })} />);
    screen.getByTestId('system-add').click();
    expect(onPickerOpen).toHaveBeenCalledWith('system');
  });

  it('renders OutputConstraintTab when activeTab is "output"', () => {
    render(<TabRenderer {...baseProps({ activeTab: 'output' })} />);
    expect(screen.getByTestId('output-constraint-tab')).toBeInTheDocument();
  });

  it('passes outputConstraints value', () => {
    render(<TabRenderer {...baseProps({ activeTab: 'output', outputConstraints: 'limit: 1000' })} />);
    expect(screen.getByTestId('output-value').textContent).toBe('limit: 1000');
  });

  it('renders OutputConstraintTab with onChange handler', () => {
    const onOutputConstraintsChange = vi.fn();
    render(<TabRenderer {...baseProps({ activeTab: 'output', onOutputConstraintsChange })} />);
    expect(screen.getByTestId('output-constraint-tab')).toBeInTheDocument();
    expect(onOutputConstraintsChange).not.toHaveBeenCalled();
  });

  it('calls onPickerOpen("output") when output add button clicked', () => {
    const onPickerOpen = vi.fn();
    render(<TabRenderer {...baseProps({ activeTab: 'output', onPickerOpen })} />);
    screen.getByTestId('output-add').click();
    expect(onPickerOpen).toHaveBeenCalledWith('output');
  });

  it('renders tools tab via ItemEditor when activeTab is "tools"', () => {
    const tools = makeListShape<AgentTool>([{ id: 't1', name: 'Tool 1', description: '', enabled: true, parameters: '' }]);
    render(<TabRenderer {...baseProps({ activeTab: 'tools', tools })} />);
    expect(screen.getByTestId('item-editor-tool')).toBeInTheDocument();
    expect(screen.getByTestId('tool-item')).toBeInTheDocument();
  });

  it('renders mcp tab via ItemEditor when activeTab is "mcp"', () => {
    const mcp = makeListShape<AgentMCP>([{ id: 'm1', name: 'MCP 1', description: '', enabled: true }]);
    render(<TabRenderer {...baseProps({ activeTab: 'mcp', mcp })} />);
    expect(screen.getByTestId('item-editor-mcp')).toBeInTheDocument();
    expect(screen.getByTestId('mcp-item')).toBeInTheDocument();
  });

  it('renders skills tab via ItemEditor when activeTab is "skills"', () => {
    const skills = makeListShape<AgentSkill>([{ id: 's1', name: 'Skill 1', description: '', enabled: true }]);
    render(<TabRenderer {...baseProps({ activeTab: 'skills', skills })} />);
    expect(screen.getByTestId('item-editor-skill')).toBeInTheDocument();
    expect(screen.getByTestId('skill-item')).toBeInTheDocument();
  });

  it('renders null for unknown activeTab', () => {
    const { container } = render(<TabRenderer {...baseProps({ activeTab: 'invalid' as any })} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders null for empty activeTab', () => {
    const { container } = render(<TabRenderer {...baseProps({ activeTab: '' as any })} />);
    expect(container.innerHTML).toBe('');
  });

  it('calls onEditTool when tool edit full clicked', () => {
    const onEditTool = vi.fn();
    const tools = makeListShape<AgentTool>([{ id: 't1', name: 'Tool 1', description: '', enabled: true, parameters: '' }]);
    render(<TabRenderer {...baseProps({ activeTab: 'tools', tools, onEditTool })} />);
    fireEvent.click(screen.getByTestId('tool-edit-full'));
    expect(onEditTool).toHaveBeenCalledWith({ id: 't1' });
  });

  it('calls onEditMcp when mcp edit full clicked', () => {
    const onEditMcp = vi.fn();
    const mcp = makeListShape<AgentMCP>([{ id: 'm1', name: 'MCP 1', description: '', enabled: true }]);
    render(<TabRenderer {...baseProps({ activeTab: 'mcp', mcp, onEditMcp })} />);
    fireEvent.click(screen.getByTestId('mcp-edit-full'));
    expect(onEditMcp).toHaveBeenCalledWith({ id: 'm1' });
  });

  it('calls onEditSkill when skill edit full clicked', () => {
    const onEditSkill = vi.fn();
    const skills = makeListShape<AgentSkill>([{ id: 's1', name: 'Skill 1', description: '', enabled: true }]);
    render(<TabRenderer {...baseProps({ activeTab: 'skills', skills, onEditSkill })} />);
    fireEvent.click(screen.getByTestId('skill-edit-full'));
    expect(onEditSkill).toHaveBeenCalledWith({ id: 's1' });
  });

  it('calls openForm when tool customize clicked', () => {
    const openForm = vi.fn();
    const form = { ...defaultForm, openForm };
    const tools = makeListShape<AgentTool>([{ id: 't1', name: 'Tool 1', description: '', enabled: true, parameters: '' }]);
    render(<TabRenderer {...baseProps({ activeTab: 'tools', tools, form })} />);
    fireEvent.click(screen.getByTestId('tool-customize'));
    expect(openForm).toHaveBeenCalledWith('tool');
  });
});
