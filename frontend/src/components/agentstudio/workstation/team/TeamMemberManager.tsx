import { memo, useEffect, useState, useMemo, useCallback } from 'react';
import { X, Plus, Loader2, Search, Minus } from 'lucide-react';
import type { TeamEntry } from './team.types';
import type { TeamMember } from '../../../../types/team';
import { listAgents } from '../../../../api/client/agents';
import { addTeamMember, removeTeamMember } from '../../../../api/client/teams';

interface Props {
  team: TeamEntry;
  onClose: () => void;
}

const AVATAR_COLORS = [
  'var(--da-accent-indigo)',
  'var(--da-accent-cyan)',
  'var(--da-accent-pink)',
  'var(--da-accent-amber)',
  'var(--da-accent-emerald)',
  'var(--da-accent-purple)',
];

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function MemberAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <span
      className="wsta-member-avatar"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `color-mix(in srgb, ${hashColor(name)} 20%, transparent)`,
        color: hashColor(name),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.45,
        fontWeight: 600,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {initial}
    </span>
  );
}

export default memo(function TeamMemberManager({ team, onClose }: Props) {
  const [members, setMembers] = useState<TeamMember[]>(team.agents || []);
  const [availAgents, setAvailAgents] = useState<{ id: string; name: string }[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAgents().then((items) => {
      if (!cancelled) setAvailAgents(items.map((a) => ({ id: a.id, name: a.name })));
    }).catch(() => {
      if (!cancelled) setError('加载 Agent 列表失败');
    });
    return () => { cancelled = true; };
  }, []);

  const memberAgentIds = useMemo(
    () => new Set(members.map((m) => m.agentConfigId).filter(Boolean)),
    [members],
  );

  const nonMemberAgents = useMemo(
    () => availAgents.filter((a) => !memberAgentIds.has(a.id)),
    [availAgents, memberAgentIds],
  );

  const filteredAgents = useMemo(() => {
    if (!agentSearch.trim()) return nonMemberAgents;
    const q = agentSearch.toLowerCase();
    return nonMemberAgents.filter((a) => a.name.toLowerCase().includes(q));
  }, [nonMemberAgents, agentSearch]);

  const handleAdd = useCallback(async (agent: { id: string; name: string }) => {
    setAddingId(agent.id);
    setError(null);
    try {
      const newMember = await addTeamMember(team.id, {
        name: agent.name,
        role: '成员',
        agent_config_id: agent.id,
      });
      setMembers((prev) => [...prev, newMember]);
    } catch {
      setError(`添加「${agent.name}」失败`);
    }
    setAddingId(null);
  }, [team.id]);

  const handleRemove = useCallback(async (memberId: string) => {
    setRemovingId(memberId);
    setError(null);
    try {
      await removeTeamMember(team.id, memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      setError('移除失败');
    }
    setRemovingId(null);
  }, [team.id]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'color-mix(in srgb, var(--da-accent) 12%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--da-accent)', fontSize: 16,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--da-font-size-base)', fontWeight: 600 }}>管理成员</h3>
              <p style={{ margin: '1px 0 0', fontSize: 'var(--da-font-size-xs)', color: 'var(--da-text-muted)' }}>{team.name}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ paddingTop: 0 }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', marginBottom: 12,
              background: 'color-mix(in srgb, var(--da-status-error) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--da-status-error) 20%, transparent)',
              borderRadius: 8,
              fontSize: 'var(--da-font-size-sm)',
              color: 'var(--da-status-error)',
            }}>
              <span style={{ flex: 1 }}>{error}</span>
              <button onClick={() => setError(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'inherit', padding: 2, display: 'flex',
              }}><X size={14} /></button>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 10,
              fontSize: 'var(--da-font-size-sm)', fontWeight: 500,
              color: 'var(--da-text-secondary)',
            }}>
              <span style={{ width: 14, height: 2, background: 'var(--da-border-strong)', borderRadius: 1 }} />
              添加成员
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px',
              border: '1px solid var(--da-border)',
              borderRadius: 8,
              background: 'var(--da-bg-surface)',
              marginBottom: 6,
              transition: 'border-color 0.2s',
            }}>
              <Search size={14} style={{ color: 'var(--da-text-tertiary)', flexShrink: 0 }} />
              <input
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="搜索 Agent..."
                style={{
                  border: 'none', outline: 'none', flex: 1,
                  fontSize: 'var(--da-font-size-sm)',
                  background: 'transparent',
                  color: 'var(--da-text-primary)',
                }}
              />
            </div>
            {filteredAgents.length === 0 ? (
              <p style={{
                fontSize: 'var(--da-font-size-xs)',
                color: 'var(--da-text-tertiary)',
                padding: '12px 0', textAlign: 'center',
              }}>
                {agentSearch ? '无匹配 Agent' : '所有 Agent 已是成员'}
              </p>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 1,
                maxHeight: 180, overflowY: 'auto',
                margin: '0 -4px', padding: '4px',
              }}>
                {filteredAgents.map((agent, idx) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAdd(agent)}
                    disabled={addingId === agent.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 10px',
                      border: 'none',
                      borderRadius: 8,
                      background: 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      animation: idx < 3 ? 'fadeSlideIn 0.25s ease-out both' : 'none',
                      animationDelay: `${idx * 30}ms`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'color-mix(in srgb, var(--da-text-primary) 4%, transparent)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <MemberAvatar name={agent.name} size={26} />
                    <span style={{
                      flex: 1, textAlign: 'left',
                      fontSize: 'var(--da-font-size-sm)',
                      color: 'var(--da-text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {agent.name}
                    </span>
                    {addingId === agent.id ? (
                      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--da-accent)', flexShrink: 0 }} />
                    ) : (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 'var(--da-font-size-xs)',
                        color: 'var(--da-accent)',
                        fontWeight: 500,
                        flexShrink: 0,
                      }}>
                        <Plus size={12} />
                        添加
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{
            height: 1, background: 'var(--da-border-subtle)',
            marginBottom: 16,
          }} />

          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 10,
              fontSize: 'var(--da-font-size-sm)', fontWeight: 500,
              color: 'var(--da-text-secondary)',
            }}>
              <span style={{ width: 14, height: 2, background: 'var(--da-border-strong)', borderRadius: 1 }} />
              当前成员
              <span style={{
                fontSize: 'var(--da-font-size-xs)',
                color: 'var(--da-text-tertiary)',
                fontWeight: 400,
              }}>
                {members.length}
              </span>
            </div>
            {members.length === 0 ? (
              <p style={{
                fontSize: 'var(--da-font-size-xs)',
                color: 'var(--da-text-tertiary)',
                padding: '16px 0', textAlign: 'center',
              }}>
                暂无成员
              </p>
            ) : (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 4,
                maxHeight: 240, overflowY: 'auto',
                margin: '0 -4px', padding: '4px',
              }}>
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="wsta-member-card"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px',
                      background: 'var(--da-bg-surface)',
                      border: '1px solid var(--da-border-subtle)',
                      borderRadius: 8,
                      transition: 'all 0.15s',
                    }}
                  >
                    <MemberAvatar name={m.name} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 'var(--da-font-size-sm)',
                        fontWeight: 500,
                        color: 'var(--da-text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {m.name}
                      </div>
                      <div style={{
                        fontSize: 'var(--da-font-size-xs)',
                        color: 'var(--da-text-tertiary)',
                      }}>
                        {m.role}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(m.id)}
                      disabled={removingId === m.id}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--da-text-tertiary)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--da-status-error) 12%, transparent)';
                        e.currentTarget.style.color = 'var(--da-status-error)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--da-text-tertiary)';
                      }}
                    >
                      {removingId === m.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Minus size={14} />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
