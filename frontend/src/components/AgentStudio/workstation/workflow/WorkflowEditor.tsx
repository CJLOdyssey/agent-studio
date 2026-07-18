import { useCallback, useEffect, useState, useRef } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Connection,
  Controls,
  MarkerType,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { WorkflowConfig, WorkflowNode, WorkflowEdge } from '../../../../types/AgentStudio';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { saveWorkflow, deleteWorkflow } from '../../../../api/client';

interface Props {
  teamId: string;
  agents: Array<{ id: string; name: string; agentConfigId?: string }>;
  existingConfig?: WorkflowConfig | null;
  onSaved?: () => void;
  onDeleted?: () => void;
}

const STRATEGIES = [
  { value: 'generator', label: '生成器' },
  { value: 'reviewer', label: '审查器' },
  { value: 'reporter', label: '报告器' },
];

function CustomNode({ id, data, selected }: NodeProps) {
  const [showStrategy, setShowStrategy] = useState(false);
  const [hovered, setHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setShowStrategy(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const strategyColors: Record<string, string> = {
    generator: '#3b82f6',
    reviewer: '#f59e0b',
    reporter: '#10b981',
  };

  const strategyLabels: Record<string, string> = {
    generator: '生成',
    reviewer: '审查',
    reporter: '报告',
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `2px solid ${selected ? '#3b82f6' : '#e5e7eb'}`,
        background: '#fff',
        minWidth: 130,
        cursor: 'pointer',
        boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.15s ease',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#94a3b8' }} />

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, paddingRight: 20 }}>
        {data.label}
      </div>

      <div
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 4,
          background: strategyColors[data.strategy as string] || '#6b7280',
          color: '#fff',
          fontSize: 11,
          cursor: 'pointer',
        }}
        onClick={(e) => {
          e.stopPropagation();
          setShowStrategy(!showStrategy);
        }}
      >
        {strategyLabels[data.strategy as string] || data.strategy}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: '#94a3b8' }} />

      {hovered && (
        <div
          onClick={(e) => { e.stopPropagation(); data.onDelete?.(id); }}
          style={{
            position: 'absolute',
            top: -8,
            right: -8,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#ef4444',
            color: '#fff',
            border: '2px solid #fff',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            zIndex: 100,
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}
        >
          ×
        </div>
      )}

      {showStrategy && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: 100,
          }}
        >
          {STRATEGIES.map((s) => (
            <div
              key={s.value}
              onClick={() => {
                data.onStrategyChange?.(s.value);
                setShowStrategy(false);
              }}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 13,
                background: data.strategy === s.value ? '#f3f4f6' : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = data.strategy === s.value ? '#f3f4f6' : 'transparent')}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { custom: CustomNode };

export default function WorkflowEditor({ teamId, agents, existingConfig, onSaved, onDeleted }: Props) {
  const initNodes: Node[] = (existingConfig?.nodes || []).map((n: WorkflowNode, i) => ({
    id: n.roleIdentifier,
    type: 'custom',
    position: { x: 100 + i * 250, y: 200 + (i % 2) * 150 },
    data: { label: n.roleIdentifier, strategy: n.strategy },
  }));
  const initEdges: Edge[] = (existingConfig?.edges || []).map((e: WorkflowEdge, i) => ({
    id: e.id || `e-${i}`,
    source: e.fromNodeId,
    target: e.toNodeId,
    label: e.conditionKey || '',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: e.conditionKey ? { stroke: '#f59e0b', strokeDasharray: '5,5' } : {},
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [name, setName] = useState(existingConfig?.name || '');
  const [maxRounds, setMaxRounds] = useState(existingConfig?.maxRounds ?? 3);
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setNodes(initNodes); setEdges(initEdges); }, [existingConfig]);

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

  const addAgentNode = useCallback((agent: { id: string; name: string }) => {
    const pos = { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 };
    setNodes((nds) => [
      ...nds,
      {
        id: agent.name,
        type: 'custom',
        position: pos,
        data: { label: agent.name, strategy: 'generator' },
      },
    ]);
  }, [setNodes]);

  const updateNodeStrategy = useCallback((nodeId: string, strategy: string) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, strategy } } : n))
    );
  }, [setNodes]);

  const handleSave = async () => {
    setSaving(true);
    const workflowNodes: WorkflowNode[] = nodes.map((n, i) => ({
      id: existingConfig?.nodes?.find((en) => en.roleIdentifier === n.id)?.id || '',
      agentConfigId: (agents.find((a) => a.name === n.id) as Record<string, unknown>)?.agentConfigId as string || (agents.find((a) => a.name === n.id) as Record<string, unknown>)?.agent_config_id as string || '',
      roleIdentifier: n.id,
      strategy: (n.data as { strategy?: string }).strategy || 'generator',
      order: i,
    }));
    const workflowEdges: WorkflowEdge[] = edges.map((e, i) => ({
      id: e.id || `e-${i}`,
      fromNodeId: e.source,
      toNodeId: e.target,
      conditionKey: (e.label as string) || undefined,
      isDefault: !e.label,
      priority: 0,
    }));
    await saveWorkflow({
      id: existingConfig?.id || '',
      teamId,
      name: name || '未命名工作流',
      maxRounds,
      nodes: workflowNodes,
      edges: workflowEdges,
    });
    setSaving(false);
    onSaved?.();
  };

  const handleDelete = async () => {
    if (!existingConfig?.id) return;
    if (!confirm('确定删除此工作流？')) return;
    await deleteWorkflow(existingConfig.id);
    onDeleted?.();
  };

  const nodesWithCallbacks = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      onStrategyChange: (strategy: string) => updateNodeStrategy(n.id, strategy),
      onDelete: (nodeId: string) => deleteNode(nodeId),
    },
  }));

  const hasSelection = selectedNodeId || selectedEdgeId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 8px', flexWrap: 'wrap' }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="工作流名称" className="form-input" style={{ width: 200 }} />
        <label style={{ fontSize: 13, color: '#6b7280' }}>最大轮次:</label>
        <input type="number" value={maxRounds} onChange={(e) => setMaxRounds(Number(e.target.value))} min={1} max={10} className="form-input" style={{ width: 60 }} />
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || nodes.length === 0}>
          {saving ? '保存中...' : '保存工作流'}
        </button>
        {existingConfig?.id && (
          <button className="btn btn-ghost" style={{ color: '#ef4444', marginLeft: 'auto' }} onClick={handleDelete}>
            删除工作流
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {agents.map((a) => (
          <button key={a.id} className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => addAgentNode(a)}>
            + {a.name}
          </button>
        ))}
        {hasSelection && (
          <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>
            按 <kbd style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, border: '1px solid #e5e7eb' }}>Delete</kbd> 删除
          </span>
        )}
      </div>
      <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8 }}>
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
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
