import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('reactflow', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const RF = {
    __esModule: true,
    default: function MockReactFlow({ nodes, edges, _onConnect, onNodeClick, onEdgeClick, onPaneClick, _nodeTypes }: Record<string, unknown>) {
      return (
        <div data-testid="reactflow-canvas">
          {Array.isArray(nodes) && (nodes as Array<{ id: string; data: { label: string } }>).map((n: { id: string; data: { label: string } }) => (
            <div key={n.id} data-testid={`node-${n.id}`} onClick={() => (onNodeClick as (...args: unknown[]) => void)?.({}, n)}>
              {n.data.label}
            </div>
          ))}
          {Array.isArray(edges) && (edges as Array<{ id: string }>).map((e: { id: string }) => (
            <div key={e.id} data-testid={`edge-${e.id}`} onClick={() => (onEdgeClick as (...args: unknown[]) => void)?.({}, e)} />
          ))}
          <button data-testid="pane" onClick={() => (onPaneClick as () => void)?.()}>pane</button>
        </div>
      );
    },
    addEdge: vi.fn((params: unknown, eds: unknown[]) => [...(eds as unknown[]), params]),
    Background: () => React.createElement('div', { 'data-testid': 'background' }),
    Controls: () => React.createElement('div', { 'data-testid': 'controls' }),
    MiniMap: () => React.createElement('div', { 'data-testid': 'minimap' }),
    Handle: () => React.createElement('div', { 'data-testid': 'handle' }),
    Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
    MarkerType: { ArrowClosed: 'arrowclosed' },
    useNodesState: (init: unknown[]) => {
      let nodes = init as Array<{ id: string; data: Record<string, unknown> }>;
      const setNodes = vi.fn((updater: unknown) => {
        if (typeof updater === 'function') nodes = updater(nodes);
        else nodes = updater as typeof nodes;
      });
      return [nodes, setNodes, vi.fn()];
    },
    useEdgesState: (init: unknown[]) => {
      let edges = init as unknown[];
      const setEdges = vi.fn((updater: unknown) => {
        if (typeof updater === 'function') edges = updater(edges);
        else edges = updater as typeof edges;
      });
      return [edges, setEdges, vi.fn()];
    },
  };
  return RF;
});

vi.mock('../../../../../api/client', () => ({
  saveWorkflow: vi.fn().mockResolvedValue({}),
  deleteWorkflow: vi.fn().mockResolvedValue(undefined),
}));

import WorkflowEditor from '../WorkflowEditor';
import { saveWorkflow, deleteWorkflow } from '../../../../../api/client';

const defaultAgents = [
  { id: 'a1', name: 'Writer', agentConfigId: 'ac1' },
  { id: 'a2', name: 'Reviewer', agentConfigId: 'ac2' },
];

describe('WorkflowEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the editor component', () => {
    render(
      <WorkflowEditor teamId="team-1" agents={defaultAgents} />,
    );
    expect(screen.getByPlaceholderText('工作流名称')).toBeInTheDocument();
    expect(screen.getByText('保存工作流')).toBeInTheDocument();
    expect(screen.getByTestId('reactflow-canvas')).toBeInTheDocument();
  });

  it('displays agent buttons for adding nodes', () => {
    render(
      <WorkflowEditor teamId="team-1" agents={defaultAgents} />,
    );
    expect(screen.getByText('+ Writer')).toBeInTheDocument();
    expect(screen.getByText('+ Reviewer')).toBeInTheDocument();
  });

  it('shows max rounds input with default value', () => {
    render(
      <WorkflowEditor teamId="team-1" agents={defaultAgents} />,
    );
    expect(screen.getByText('最大轮次:')).toBeInTheDocument();
    const maxRoundsInput = screen.getByDisplayValue('3');
    expect(maxRoundsInput).toBeInTheDocument();
  });

  it('handles workflow name input change', () => {
    render(
      <WorkflowEditor teamId="team-1" agents={defaultAgents} />,
    );
    const nameInput = screen.getByPlaceholderText('工作流名称');
    fireEvent.change(nameInput, { target: { value: 'Test Workflow' } });
    expect(nameInput).toHaveValue('Test Workflow');
  });

  it('handles max rounds input change', () => {
    render(
      <WorkflowEditor teamId="team-1" agents={defaultAgents} />,
    );
    const maxRoundsInput = screen.getByDisplayValue('3');
    fireEvent.change(maxRoundsInput, { target: { value: '5' } });
    expect(maxRoundsInput).toHaveValue(5);
  });

  it('disables save button when no nodes exist', () => {
    render(
      <WorkflowEditor teamId="team-1" agents={defaultAgents} />,
    );
    const saveButton = screen.getByText('保存工作流');
    expect(saveButton).toBeDisabled();
  });

  it('does not show delete button when no existing config', () => {
    render(
      <WorkflowEditor teamId="team-1" agents={defaultAgents} />,
    );
    expect(screen.queryByText('删除工作流')).not.toBeInTheDocument();
  });

  it('shows delete button when existing config has id', () => {
    render(
      <WorkflowEditor
        teamId="team-1"
        agents={defaultAgents}
        existingConfig={{ id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3, nodes: [], edges: [] }}
      />,
    );
    expect(screen.getByText('删除工作流')).toBeInTheDocument();
  });

  it('populates editor with existing config nodes', () => {
    const config = {
      id: 'wf-1',
      teamId: 'team-1',
      name: 'Existing Workflow',
      maxRounds: 5,
      nodes: [
        { id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy: 'generator', order: 0 },
      ],
      edges: [],
    };
    render(
      <WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={config} />,
    );
    expect(screen.getByDisplayValue('Existing Workflow')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();
  });

  it('calls onSaved callback after save', async () => {
    vi.mocked(saveWorkflow).mockResolvedValue({} as never);
    const onSaved = vi.fn();
    const config = {
      id: 'wf-1',
      teamId: 'team-1',
      name: 'Test',
      maxRounds: 3,
      nodes: [
        { id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy: 'generator', order: 0 },
      ],
      edges: [],
    };
    render(
      <WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={config} onSaved={onSaved} />,
    );
    const saveButton = screen.getByText('保存工作流');
    fireEvent.click(saveButton);
    expect(saveWorkflow).toHaveBeenCalled();
  });

  it('calls onDeleted callback after delete', async () => {
    vi.mocked(deleteWorkflow).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onDeleted = vi.fn();
    render(
      <WorkflowEditor
        teamId="team-1"
        agents={defaultAgents}
        existingConfig={{ id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3, nodes: [], edges: [] }}
        onDeleted={onDeleted}
      />,
    );
    const deleteButton = screen.getByText('删除工作流');
    fireEvent.click(deleteButton);
    expect(deleteWorkflow).toHaveBeenCalledWith('wf-1');
    vi.restoreAllMocks();
  });

  it('selects node on click and shows delete hint', () => {
    const config = {
      id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3,
      nodes: [{ id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy: 'generator', order: 0 }],
      edges: [],
    };
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={config} />);
    fireEvent.click(screen.getByTestId('node-Writer'));
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
  });

  it('deselects node on pane click', () => {
    const config = {
      id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3,
      nodes: [{ id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy: 'generator', order: 0 }],
      edges: [],
    };
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={config} />);
    fireEvent.click(screen.getByTestId('node-Writer'));
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pane'));
    expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
  });

  it('shows saving text while saving', async () => {
    vi.mocked(saveWorkflow).mockImplementation(() => new Promise(() => {}));
    const config = {
      id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3,
      nodes: [{ id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy: 'generator', order: 0 }],
      edges: [],
    };
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={config} />);
    fireEvent.click(screen.getByText('保存工作流'));
    expect(screen.getByText('保存中...')).toBeInTheDocument();
  });

  it('selects edge on click and shows delete hint', () => {
    const config = {
      id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3,
      nodes: [
        { id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy: 'generator', order: 0 },
      ],
      edges: [{ id: 'e1', fromNodeId: 'Writer', toNodeId: 'Reviewer', isDefault: true, priority: 0 }],
    };
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={config} />);
    fireEvent.click(screen.getByTestId('edge-e1'));
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
  });

  it('deselects edge on pane click', () => {
    const config = {
      id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3,
      nodes: [
        { id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy: 'generator', order: 0 },
      ],
      edges: [{ id: 'e1', fromNodeId: 'Writer', toNodeId: 'Reviewer', isDefault: true, priority: 0 }],
    };
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={config} />);
    fireEvent.click(screen.getByTestId('edge-e1'));
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pane'));
    expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
  });

  it('removes node on Delete key', () => {
    const config = {
      id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3,
      nodes: [{ id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy: 'generator', order: 0 }],
      edges: [],
    };
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={config} />);
    fireEvent.click(screen.getByTestId('node-Writer'));
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Delete' });
    expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
  });

  it('removes node on Backspace key', () => {
    const config = {
      id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3,
      nodes: [{ id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy: 'generator', order: 0 }],
      edges: [],
    };
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={config} />);
    fireEvent.click(screen.getByTestId('node-Writer'));
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(screen.queryByText(/Delete/)).not.toBeInTheDocument();
  });

  it('cancels delete when confirm returns false', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<WorkflowEditor
      teamId="team-1" agents={defaultAgents}
      existingConfig={{ id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3, nodes: [], edges: [] }}
    />);
    fireEvent.click(screen.getByText('删除工作流'));
    expect(deleteWorkflow).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
