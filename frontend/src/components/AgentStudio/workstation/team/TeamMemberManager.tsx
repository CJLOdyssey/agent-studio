import { memo } from 'react';
import { X, Plus, Loader2, Search, Minus } from 'lucide-react';
import type { TeamEntry } from './team.types';
import useTeamMemberManager from './useTeamMemberManager';

interface Props {
  team: TeamEntry;
  onClose: () => void;
}

const AVATAR_COLORS = [
  'var(--color-accent)',
  'var(--color-accent)',
  'var(--color-accent-hover)',
  'var(--color-accent-soft)',
  'var(--color-accent)',
  'var(--color-accent)',
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
      className="rounded-full flex items-center justify-center shrink-0 font-semibold leading-none"
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${hashColor(name)} 20%, transparent)`,
        color: hashColor(name),
        fontSize: size * 0.45,
      }}
    >
      {initial}
    </span>
  );
}

export default memo(function TeamMemberManager({ team, onClose }: Props) {
  const {
    members,
    agentSearch,
    setAgentSearch,
    filteredAgents,
    handleAdd,
    handleRemove,
    removingId,
    addingId,
    error,
    setError,
  } = useTeamMemberManager(team);

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[90%] max-w-[480px] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] flex items-center justify-center text-[var(--color-accent)] text-base">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            <div>
              <h3 className="m-0 text-[var(--da-font-size-base)] font-semibold">管理成员</h3>
              <p className="mt-[1px] mb-0 text-[var(--da-font-size-xs)] text-[var(--color-text-muted)]">{team.name}</p>
            </div>
          </div>
          <button className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label="关闭"><X size={18} /></button>
        </div>

        <div className="p-5 pt-0 overflow-y-auto flex-1 min-h-0 flex flex-col">
          {error && (
            <div className="flex items-center gap-2 py-2 px-3 mb-3 bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-danger)_20%,transparent)] rounded-lg text-[var(--da-font-size-sm)] text-[var(--color-danger)]">
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="bg-transparent border-none cursor-pointer text-inherit p-0.5 flex"><X size={14} /></button>
            </div>
          )}

          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2.5 text-[var(--da-font-size-sm)] font-medium text-[var(--color-text-secondary)]">
              <span className="w-3.5 h-0.5 bg-[var(--color-border-strong)] rounded-[1px]" />
              添加成员
            </div>
            <div className="flex items-center gap-2 py-2 px-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-raised)] mb-1.5 transition-[border-color] duration-200">
              <Search size={14} className="text-[var(--color-text-tertiary)] shrink-0" />
              <input
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="搜索 Agent..."
                className="border-none outline-none flex-1 text-[var(--da-font-size-sm)] bg-transparent text-[var(--color-text-primary)]"
              />
            </div>
            {filteredAgents.length === 0 ? (
              <p className="text-[var(--da-font-size-xs)] text-[var(--color-text-tertiary)] py-3 text-center">
                {agentSearch ? '无匹配 Agent' : '所有 Agent 已是成员'}
              </p>
            ) : (
              <div className="flex flex-col gap-px max-h-[180px] overflow-y-auto -mx-1 px-1">
                {filteredAgents.map((agent, idx) => (
                  <button
                    key={agent.id}
                    onClick={() => handleAdd(agent)}
                    disabled={addingId === agent.id}
                    className="flex items-center gap-2.5 py-[7px] px-2.5 border-none rounded-lg bg-transparent cursor-pointer transition-all duration-150 hover:bg-[color-mix(in_srgb,var(--color-text-primary)_4%,transparent)]"
                    style={{ animation: idx < 3 ? 'fadeSlideIn 0.25s ease-out both' : 'none', animationDelay: `${idx * 30}ms` }}
                  >
                    <MemberAvatar name={agent.name} size={26} />
                    <span className="flex-1 text-left text-[var(--da-font-size-sm)] text-[var(--color-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap">
                      {agent.name}
                    </span>
                    {addingId === agent.id ? (
                      <Loader2 size={14} className="animate-spin text-[var(--color-accent)] shrink-0" />
                    ) : (
                      <span className="flex items-center gap-1 text-[var(--da-font-size-xs)] text-[var(--color-accent)] font-medium shrink-0">
                        <Plus size={12} />
                        添加
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-[var(--color-border)] mb-4" />

          <div>
            <div className="flex items-center gap-2 mb-2.5 text-[var(--da-font-size-sm)] font-medium text-[var(--color-text-secondary)]">
              <span className="w-3.5 h-0.5 bg-[var(--color-border-strong)] rounded-[1px]" />
              当前成员
              <span className="text-[var(--da-font-size-xs)] text-[var(--color-text-tertiary)] font-normal">
                {members.length}
              </span>
            </div>
            {members.length === 0 ? (
              <p className="text-[var(--da-font-size-xs)] text-[var(--color-text-tertiary)] py-4 text-center">
                暂无成员
              </p>
            ) : (
              <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto -mx-1 px-1">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 py-2 px-2.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-lg transition-all duration-150 hover:border-[var(--color-border)]"
                  >
                    <MemberAvatar name={m.name} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[var(--da-font-size-sm)] font-medium text-[var(--color-text-primary)] overflow-hidden text-ellipsis whitespace-nowrap">
                        {m.name}
                      </div>
                      <div className="text-[var(--da-font-size-xs)] text-[var(--color-text-tertiary)]">
                        {m.role}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(m.id)}
                      disabled={removingId === m.id}
                      className="w-7 h-7 rounded-md flex items-center justify-center border-none bg-transparent text-[var(--color-text-tertiary)] cursor-pointer transition-all duration-150 shrink-0 hover:bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] hover:text-[var(--color-danger)]"
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
