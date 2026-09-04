import { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  addEdge,
  Connection,
  Controls,
  MarkerType,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { WorkflowConfig, WorkflowNode, WorkflowEdge } from '../../../../types/AgentStudio';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { saveWorkflow, deleteWorkflow, submitRequirement } from '../../../../api/client';
import { useToast } from '../../../../utils/useToast';
import { CustomNode } from './WorkflowNodeComponent';

interface Props {
  teamId: string;
  agents: Array<{ id: string; name: string; agentConfigId?: string }>;
  existingConfig?: WorkflowConfig | null;
  onSaved?: () => void;
  onDeleted?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

function getAgentConfigId(agent: { id: string; name: string; agentConfigId?: string } | Record<string, unknown> | undefined): string {
  if (!agent) return '';
  const a = agent as Record<string, unknown>;
  const v = a.agentConfigId ?? a.agent_config_id;
  return typeof v === 'string' ? v : '';
}

function hasCycle(ns: Node[], es: Edge[]): boolean {
  const adjacency: Record<string, string[]> = {};
  ns.forEach((n) => { adjacency[n.id] = []; });
  es.forEach((e) => {
    if (e.source && adjacency[e.source]) adjacency[e.source].push(e.target);
  });
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color: Record<string, number> = {};
  ns.forEach((n) => { color[n.id] = WHITE; });
  const dfs = (id: string): boolean => {
    color[id] = GRAY;
    for (const next of adjacency[id] || []) {
      if (!(next in color)) continue;
      if (color[next] === GRAY) return true;
      if (color[next] === WHITE && dfs(next)) return true;
    }
    color[id] = BLACK;
    return false;
  };
  return ns.some((n) => color[n.id] === WHITE && dfs(n.id));
}

function serializeWorkflow(ns: Node[], es: Edge[], name: string, maxRounds: number): string {
  return JSON.stringify({
    name,
    maxRounds,
    nodes: ns.map((n) => ({
      id: n.id,
      label: (n.data as { label?: string }).label,
      strategy: (n.data as { strategy?: string }).strategy,
    })),
    edges: es.map((e) => ({ source: e.source, target: e.target, label: e.label })),
  });
}

const nodeTypes = { custom: CustomNode };

export default function WorkflowEditor({ teamId, agents, existingConfig, onSaved, onDeleted, onDirtyChange }: Props) {
  const initNodes: Node[] = (existingConfig?.nodes || []).map((n: WorkflowNode, i) => {
    const agent = agents.find((a) => getAgentConfigId(a) === n.agentConfigId);
    return {
      id: n.agentConfigId || n.id || n.roleIdentifier,
      type: 'custom',
      position: { x: 100 + i * 250, y: 200 + (i % 2) * 150 },
      data: { label: agent?.name || n.roleIdentifier, strategy: n.strategy },
    };
  });
  const initEdges: Edge[] = (existingConfig?.edges || []).map((e: WorkflowEdge, i) => {
    const toRfId = (nodeId: string, fallback: string) => {
      const node = existingConfig?.nodes?.find((n) => n.roleIdentifier === nodeId || n.id === nodeId);
      return node ? node.agentConfigId || node.id || node.roleIdentifier : fallback;
    };
    return {
      id: e.id || `e-${i}`,
      source: toRfId(e.fromNodeId, e.fromNodeId),
      target: toRfId(e.toNodeId, e.toNodeId),
      label: e.conditionKey || '',
      markerEnd: { type: MarkerType.ArrowClosed },
      style: e.conditionKey ? { stroke: '#f59e0b', strokeDasharray: '5,5' } : {},
    };
  });

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [name, setName] = useState(existingConfig?.name || '');
  const [maxRounds, setMaxRounds] = useState(existingConfig?.maxRounds ?? 3);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const lastSnapshotRef = useRef('');
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  });
  const { toast } = useToast();

  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    setNodes(initNodes);
    setEdges(initEdges);
    setName(existingConfig?.name || '');
    setMaxRounds(existingConfig?.maxRounds ?? 3);
    lastSnapshotRef.current = serializeWorkflow(initNodes, initEdges, existingConfig?.name || '', existingConfig?.maxRounds ?? 3);
  }, [existingConfig]);
  /* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  useEffect(() => {
    const changed = serializeWorkflow(nodes, edges, name, maxRounds) !== lastSnapshotRef.current;
    setDirty(changed);
    onDirtyChangeRef.current?.(changed);
  }, [nodes, edges, name, maxRounds]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
          setEdges((eds) => eds.filter((ed) => ed.source !== selectedNodeId && ed.target !== selectedNodeId));
          setSelectedNodeId(null);
        } else if (selectedEdgeId) {
          setEdges((eds) => eds.filter((ed) => ed.id !== selectedEdgeId));
          setSelectedEdgeId(null);
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    if (params.source === params.target) return;
    setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_event: ReactMouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_event: ReactMouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((ed) => ed.source !== nodeId && ed.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }, [setNodes, setEdges, selectedNodeId]);

  const addAgentNode = useCallback((agent: { id: string; name: string; agentConfigId?: string }) => {
    const nodeId = getAgentConfigId(agent) || agent.id;
    const pos = { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 };
    setNodes((nds) => {
      if (nds.some((n) => n.id === nodeId)) return nds;
      return [
        ...nds,
        {
          id: nodeId,
          type: 'custom',
          position: pos,
          data: { label: agent.name, strategy: 'generator' },
        },
      ];
    });
  }, [setNodes]);

  const updateNodeStrategy = useCallback((nodeId: string, strategy: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, strategy } } : n))
    );
  }, [setNodes]);

  const handleSave = async () => {
    if (nodes.length === 0) return;
    if (hasCycle(nodes, edges)) {
      alert('工作流中存在环路（可能造成死循环），请调整连线后再保存');
      return;
    }
    setSaving(true);
    try {
      const workflowNodes: WorkflowNode[] = nodes.map((n, i) => {
        const existingNode = existingConfig?.nodes?.find(
          (en) => en.agentConfigId === n.id || en.id === n.id
        );
        const agent = agents.find((a) => a.id === n.id || getAgentConfigId(a) === n.id);
        return {
          id: existingNode?.id || '',
          agentConfigId: getAgentConfigId(agent),
          roleIdentifier: (n.data as { label?: string }).label || n.id,
          strategy: (n.data as { strategy?: string }).strategy || 'generator',
          order: i,
        };
      });
      const roleById = new Map(nodes.map((n) => [n.id, (n.data as { label?: string }).label || n.id]));
      const workflowEdges: WorkflowEdge[] = edges.map((e, i) => {
        const fromId = roleById.get(e.source) || e.source;
        const toId = roleById.get(e.target) || e.target;
        return {
          id: e.id || `e-${i}`,
          fromNodeId: fromId,
          toNodeId: toId,
          conditionKey: (e.label as string) || undefined,
          isDefault: !e.label,
          priority: 0,
        };
      });
      await saveWorkflow({
        id: existingConfig?.id || '',
        teamId,
        name: name || '未命名工作流',
        maxRounds,
        nodes: workflowNodes,
        edges: workflowEdges,
      });
      lastSnapshotRef.current = serializeWorkflow(nodes, edges, name, maxRounds);
      setDirty(false);
      onDirtyChangeRef.current?.(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  const handleTestRun = async () => {
    if (nodes.length === 0) return;
    if (hasCycle(nodes, edges)) {
      alert('工作流中存在环路，无法执行。请先解除环路。');
      return;
    }
    const requirement = window.prompt('输入测试需求（将先保存工作流，再启动一次实际运行）:', '测试运行');
    if (requirement === null || !requirement.trim()) return;
    setTesting(true);
    try {
      await handleSave();
      const res = await submitRequirement(requirement.trim(), undefined, undefined, undefined, undefined, teamId);
      toast(`✅ 测试运行已启动 (${res.run_id})`, 'success');
    } catch (e) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string };
      toast(`❌ ${err.response?.data?.detail || err.message || '测试运行失败'}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingConfig?.id) return;
    if (!confirm('确定删除此工作流？')) return;
    await deleteWorkflow(existingConfig.id);
    onDeleted?.();
  };

  const entryNodeId = nodes[0]?.id;
  const nodesWithCallbacks = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      isEntry: n.id === entryNodeId,
      onStrategyChange: (strategy: string) => updateNodeStrategy(n.id, strategy),
      onDelete: (nodeId: string) => deleteNode(nodeId),
    },
  }));

  const hasSelection = selectedNodeId || selectedEdgeId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 8px', flexWrap: 'wrap' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="工作流名称" className="w-full px-3 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm transition-colors duration-150 focus:border-[var(--color-accent)] focus:outline-none" style={{ width: 200 }} />
        <label style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>最大轮次:</label>
        <input type="number" value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} min={1} max={10} className="w-full px-3 py-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm transition-colors duration-150 focus:border-[var(--color-accent)] focus:outline-none" style={{ width: 60 }} />
        <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed" onClick={handleSave} disabled={saving || testing || nodes.length === 0}>
          {saving ? '保存中...' : '保存工作流'}
        </button>
        <button
          className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-opacity duration-150 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: '#2563eb', color: '#fff' }}
          onClick={handleTestRun}
          disabled={saving || testing || nodes.length === 0}
          title={nodes.length === 0 ? '请先添加节点' : '保存工作流并启动一次测试运行'}
        >
          {testing ? '运行中...' : '测试运行'}
        </button>
        {dirty && <span style={{ fontSize: 12, color: '#f59e0b' }}>● 未保存</span>}
        {existingConfig?.id && (
          <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]" style={{ color: '#ef4444', marginLeft: 'auto' }} onClick={handleDelete}>
            删除工作流
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {agents.map((a) => (
          <button key={a.id} className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-accent)]" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => addAgentNode(a)}>
            + {a.name}
          </button>
        ))}
        {hasSelection && (
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>
            按 <kbd style={{ background: 'var(--color-surface-hover)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border-strong)' }}>Delete</kbd> 删除
          </span>
        )}
      </div>
      <div style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)' }}>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges.map((e) => ({
            ...e,
            style: {
              ...e.style,
              stroke: selectedEdgeId === e.id ? '#3b82f6' : e.style?.stroke || '#94a3b8',
              strokeWidth: selectedEdgeId === e.id ? 2 : 1,
            },
          }))}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          fitView
        >
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
