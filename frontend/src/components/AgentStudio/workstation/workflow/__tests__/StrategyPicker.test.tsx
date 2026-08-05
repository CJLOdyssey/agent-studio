import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('reactflow', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const RF = {
    __esModule: true,
    default: function MockReactFlow({ nodes }: Record<string, unknown>) {
      return React.createElement(
        'div',
        { 'data-testid': 'reactflow-canvas' },
        (nodes as Array<{ id: string; data: Record<string, unknown> }>).map((n) =>
          React.createElement(
            'div',
            { key: n.id, 'data-testid': `node-${n.id}` },
            React.createElement('span', { 'data-testid': `chip-${n.id}` }, String(n.data.strategy)),
            React.createElement('button', {
              'data-testid': `menu-${n.id}`,
              onClick: () => (n.data.onStrategyChange as ((s: string) => void) | undefined)?.('reviewer'),
            }, 'reviewer'),
          ),
        ),
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
      const [nodes, setNodes] = React.useState(init as Array<{ id: string; data: Record<string, unknown> }>);
      return [nodes, setNodes, vi.fn()];
    },
    useEdgesState: (init: unknown[]) => {
      const [edges, setEdges] = React.useState(init as unknown[]);
      return [edges, setEdges, vi.fn()];
    },
  };
  return RF;
});

vi.mock('../../../../../api/client', () => ({
  saveWorkflow: vi.fn().mockResolvedValue({}),
  deleteWorkflow: vi.fn().mockResolvedValue(undefined),
  submitRequirement: vi.fn().mockResolvedValue({ run_id: 'r1', status: 'pending' }),
}));

import WorkflowEditor from '../WorkflowEditor';
import { saveWorkflow } from '../../../../../api/client';

const defaultAgents = [
  { id: 'a1', name: 'Writer', agentConfigId: 'ac1' },
  { id: 'a2', name: 'Reviewer', agentConfigId: 'ac2' },
];

function singleNodeConfig(strategy = 'generator') {
  return {
    id: 'wf-1', teamId: 'team-1', name: 'Test', maxRounds: 3,
    nodes: [{ id: 'n1', agentConfigId: 'ac1', roleIdentifier: 'Writer', strategy, order: 0 }],
    edges: [],
  };
}

describe('StrategyPicker', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds nodes with generator strategy by default', async () => {
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} />);
    fireEvent.click(screen.getByText('+ Writer'));
    fireEvent.click(screen.getByText('保存工作流'));
    await waitFor(() => {
      expect(saveWorkflow).toHaveBeenCalled();
    });
    const args = vi.mocked(saveWorkflow).mock.calls[0][0];
    expect(args.nodes[0].strategy).toBe('generator');
  });

  it('routes strategy picker to updateNodeStrategy and saves reviewer', async () => {
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={singleNodeConfig('generator')} />);
    expect(screen.getByTestId('chip-ac1').textContent).toBe('generator');
    fireEvent.click(screen.getByTestId('menu-ac1'));
    await waitFor(() => {
      expect(screen.getByTestId('chip-ac1').textContent).toBe('reviewer');
    });
    fireEvent.click(screen.getByText('保存工作流'));
    await waitFor(() => {
      expect(saveWorkflow).toHaveBeenCalled();
    });
    const args = vi.mocked(saveWorkflow).mock.calls[0][0];
    expect(args.nodes[0].strategy).toBe('reviewer');
  });

  it('persists a reviewer strategy loaded from an existing config', async () => {
    render(<WorkflowEditor teamId="team-1" agents={defaultAgents} existingConfig={singleNodeConfig('reviewer')} />);
    fireEvent.click(screen.getByText('保存工作流'));
    await waitFor(() => {
      expect(saveWorkflow).toHaveBeenCalled();
    });
    const args = vi.mocked(saveWorkflow).mock.calls[0][0];
    expect(args.nodes[0].strategy).toBe('reviewer');
  });
});
