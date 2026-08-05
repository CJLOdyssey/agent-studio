import { useEffect, useState, useRef } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';

const STRATEGIES = [
  { value: 'generator', label: '生成器' },
  { value: 'reviewer', label: '审查器' },
  { value: 'reporter', label: '报告器' },
];

export function CustomNode({ id, data, selected }: NodeProps) {
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
        borderRadius: 'var(--radius-card)',
        border: `2px solid ${selected ? '#3b82f6' : 'var(--color-border-strong)'}`,
        background: 'var(--color-surface-raised)',
        minWidth: 130,
        cursor: 'pointer',
        boxShadow: selected ? '0 0 0 3px rgba(59,130,246,0.2)' : '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.15s ease',
        position: 'relative',
        overflow: 'visible',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: 'var(--color-border-strong)' }} />

      {data.isEntry && (
        <div
          style={{
            position: 'absolute',
            top: -9,
            left: -9,
            background: '#10b981',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 8px',
            borderRadius: 999,
            letterSpacing: '0.05em',
            boxShadow: '0 1px 3px rgba(16,185,129,0.4)',
          }}
        >
          入口
        </div>
      )}

      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, paddingRight: 20, color: 'var(--color-text-primary)' }}>
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

      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--color-border-strong)' }} />

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
            border: '2px solid var(--color-surface-raised)',
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
            background: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-btn)',
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
                background: data.strategy === s.value ? 'var(--color-surface-hover)' : 'transparent',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = data.strategy === s.value ? 'var(--color-surface-hover)' : 'transparent')}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
