import type { WorkflowNode } from '../../types/agentstudio';

interface WorkflowEvent {
  node: string;
  phase: 'start' | 'end';
}

interface WorkflowTeamMessageProps {
  nodes: WorkflowNode[];
  events: WorkflowEvent[];
  artifacts: Record<string, string>;
  roundNumber: number;
}

const STRATEGY_LABELS: Record<string, string> = { generator: '生成', reviewer: '审查', reporter: '汇总' };
const STRATEGY_ICONS: Record<string, string> = { generator: '📝', reviewer: '🔍', reporter: '📋' };

export default function WorkflowTeamMessage({ nodes, events, artifacts, roundNumber }: WorkflowTeamMessageProps) {
  const sortedNodes = [...nodes].sort((a, b) => a.order - b.order);
  return (
    <div className="team-message" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
      <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
        团队工作流 · 第 {roundNumber} 轮 · {sortedNodes.length} 个 Agent
      </div>
      {sortedNodes.map((node) => {
        const nodeEvents = events.filter((e) => e.node === node.roleIdentifier);
        const isComplete = nodeEvents.some((e) => e.phase === 'end');
        const output = artifacts[node.roleIdentifier] || '';
        const strategy = node.strategy || 'generator';
        return (
          <div key={node.roleIdentifier} style={{
            border: `1px solid ${isComplete ? '#22c55e' : '#e5e7eb'}`,
            borderRadius: 8, padding: '12px 16px',
            background: isComplete ? '#f0fdf4' : '#f9fafb',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span>{STRATEGY_ICONS[strategy] || '🤖'}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{node.roleIdentifier}</span>
                <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: strategy === 'generator' ? '#dbeafe' : strategy === 'reviewer' ? '#fef3c7' : '#dcfce7', color: strategy === 'generator' ? '#1d4ed8' : strategy === 'reviewer' ? '#92400e' : '#166534' }}>
                  {STRATEGY_LABELS[strategy] || strategy}
                </span>
              </div>
              <span style={{ fontSize: 12, color: isComplete ? '#22c55e' : '#9ca3af' }}>
                {isComplete ? '✓ 完成' : '⏳ 进行中...'}
              </span>
            </div>
            {output && (
              <div style={{ fontSize: 13, color: '#374151', background: '#fff', padding: '8px 12px', borderRadius: 6, maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', border: '1px solid #f3f4f6' }}>
                {output.slice(0, 500)}{output.length > 500 && '...'}
              </div>
            )}
            {!output && !isComplete && (
              <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>等待 Agent 回复...</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
