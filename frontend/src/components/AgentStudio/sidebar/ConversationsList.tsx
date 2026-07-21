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
        className={`agentstudio-conv-item ${isActive ? 'active' : ''}`}
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
        <div className="agentstudio-conv-item-content">
          <div className="agentstudio-conv-item-title">
            {isTeam && (
              <span className="agentstudio-conv-item-agent-icon" style={{ color: 'var(--da-accent)' }}>
                <Users size={12} />
              </span>
            )}
            {agent && AgentIcon && !isTeam && (
              <span className="agentstudio-conv-item-agent-icon" style={{ color: agent.color }}>
                <AgentIcon size={12} />
              </span>
            )}
            {Array.from(conv.title).length > 26
              ? Array.from(conv.title).slice(0, 26).join('') + '...'
              : conv.title}
          </div>
          <div className="agentstudio-conv-item-meta">
            {isTeam && (
              <span className="agentstudio-conv-item-agent-name" style={{ color: 'var(--da-accent)' }}>{conv.teamName || '团队'}</span>
            )}
            {agent && !isTeam && (
              <span className="agentstudio-conv-item-agent-name">{agent.name}</span>
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
          className="agentstudio-conv-delete"
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
    <div className="agentstudio-conversations-list">
      <Virtuoso
        style={{ height: '300px' }}
        data={flatItems}
        itemContent={(_index: number, item: (typeof flatItems)[number]) =>
          item.type === 'group' ? (
            <div className="agentstudio-conv-group-label">{item.label}</div>
          ) : (
            renderConversationItem(item.conv)
          )
        }
      />
    </div>
  );
});

export default ConversationsList;
