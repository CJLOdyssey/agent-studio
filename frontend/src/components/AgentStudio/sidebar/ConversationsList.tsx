import { memo, useMemo } from 'react';
import { Trash2, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';
import type { Conversation, Agent } from '../../../types/AgentStudio';

interface ConversationsListProps {
  conversations: Conversation[];
  activeConvId: string | null;
  selectedAgentId: string | null;
  agents?: Agent[];
  onSelect: (conv: Conversation) => void;
  onDelete: (convId: string) => void;
}

const ConversationsList = memo(function ConversationsList({
  conversations,
  activeConvId,
  selectedAgentId,
  agents = [],
  onSelect,
  onDelete,
}: ConversationsListProps) {
  const { t, i18n } = useTranslation();

  const groupedConversations = useMemo(() => {
    const groups = {
      pinned: [] as Conversation[],
      today: [] as Conversation[],
      yesterday: [] as Conversation[],
      threeDays: [] as Conversation[],
      sevenDays: [] as Conversation[],
      month: [] as Conversation[],
      older: [] as Conversation[],
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    conversations.forEach((conv) => {
      const convDate = new Date(conv.updatedAt);
      const convStart = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate()).getTime();
      const diffDays = Math.floor((todayStart - convStart) / oneDay);

      if (diffDays <= 0) {
        groups.today.push(conv);
      } else if (diffDays === 1) {
        groups.yesterday.push(conv);
      } else if (diffDays <= 3) {
        groups.threeDays.push(conv);
      } else if (diffDays <= 7) {
        groups.sevenDays.push(conv);
      } else if (diffDays <= 30) {
        groups.month.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  }, [conversations]);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);

  const nonEmptyGroups = useMemo(() => {
    return [
      { label: t('sidebar.today'), items: groupedConversations.today },
      { label: t('sidebar.yesterday'), items: groupedConversations.yesterday },
      { label: t('sidebar.threeDays'), items: groupedConversations.threeDays },
      { label: t('sidebar.sevenDays'), items: groupedConversations.sevenDays },
      { label: t('sidebar.month'), items: groupedConversations.month },
      { label: t('sidebar.older'), items: groupedConversations.older },
    ].filter((g) => g.items.length > 0);
  }, [groupedConversations, t]);

  if (nonEmptyGroups.length === 0) return null;

  const flatItems = nonEmptyGroups.flatMap((g) => [
    { type: 'group' as const, label: g.label },
    ...g.items.map((conv) => ({ type: 'item' as const, conv })),
  ]);

  const renderConversationItem = (conv: Conversation) => {
    const agent = conv.agentId ? agentMap.get(conv.agentId) : undefined;
    const AgentIcon = agent?.icon;
    const isTeam = !!conv.teamId;
    const isActive = activeConvId === conv.id && !selectedAgentId;
    return (
      <div
        key={conv.id}
        className={`group flex items-center justify-between py-2 px-2 rounded-md cursor-pointer transition-colors duration-150 gap-2 hover:bg-[var(--color-surface-hover)] ${isActive ? 'bg-[var(--color-surface-elevated)]' : ''}`}
        onClick={() => onSelect(conv)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(conv);
          }
        }}
        tabIndex={0}
        role="button"
        aria-selected={isActive}
      >
        <div className="flex-1 min-w-0">
          <div className="text-sm text-[var(--color-text-primary)] leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1">
            {isTeam && (
              <span className="shrink-0 flex items-center" style={{ color: 'var(--color-accent)' }}>
                <Users size={12} />
              </span>
            )}
            {agent && AgentIcon && !isTeam && (
              <span className="shrink-0 flex items-center" style={{ color: agent.color }}>
                <AgentIcon size={12} />
              </span>
            )}
            {Array.from(conv.title).length > 26
              ? Array.from(conv.title).slice(0, 26).join('') + '...'
              : conv.title}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-[2px] flex items-center gap-1">
            {isTeam && (
              <span className="text-[var(--color-text-secondary)] font-medium" style={{ color: 'var(--color-accent)' }}>{conv.teamName || '团队'}</span>
            )}
            {agent && !isTeam && (
              <span className="text-[var(--color-text-secondary)] font-medium">{agent.name}</span>
            )}
            {conv.messages.filter((m) => m.role === 'agent').length > 0
              ? t('sidebar.replied')
              : t('sidebar.pendingReply')}
            {' · '}
            {new Date(conv.updatedAt).toLocaleDateString(
              i18n.language === 'en-US' ? 'en-US' : 'zh-CN',
              { month: 'short', day: 'numeric' },
            )}
          </div>
        </div>
        <button
          className="shrink-0 p-1 rounded bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer opacity-0 transition-opacity flex items-center justify-center group-hover:opacity-100 hover:text-[var(--color-danger)]"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conv.id);
          }}
          aria-label={t('common.delete')}
        >
          <Trash2 size={14} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2 mb-1">
      <Virtuoso
        style={{ height: '300px' }}
        data={flatItems}
        itemContent={(_index: number, item: (typeof flatItems)[number]) =>
          item.type === 'group' ? (
            <div className="text-xs font-semibold text-[var(--color-text-muted)] py-1 px-2 flex items-center gap-1">{item.label}</div>
          ) : (
            renderConversationItem(item.conv)
          )
        }
      />
    </div>
  );
});

export default ConversationsList;
