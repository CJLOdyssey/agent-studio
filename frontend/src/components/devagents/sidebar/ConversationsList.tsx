import { memo } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Conversation } from '../../../types/devagents';

interface ConversationsListProps {
  conversations: Conversation[];
  activeConvId: number | null;
  selectedAgentId: string | null;
  onSelect: (conv: Conversation) => void;
  onDelete: (convId: number) => void;
  onCloseSidebar: () => void;
}

const ConversationsList = memo(function ConversationsList({
  conversations,
  activeConvId,
  selectedAgentId,
  onSelect,
  onDelete,
  onCloseSidebar,
}: ConversationsListProps) {
  const { t, i18n } = useTranslation();

  if (conversations.length === 0) return null;

  return (
    <>
      <div className="devagents-section-header">
        <div className="devagents-section-title">
          <MessageSquare size={14} />
          {t('sidebar.history')}
        </div>
      </div>
      <div className="devagents-conversations-list">
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={`devagents-conv-item ${activeConvId === conv.id && !selectedAgentId ? 'active' : ''}`}
            onClick={() => { onSelect(conv); onCloseSidebar(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(conv);
                onCloseSidebar();
              }
            }}
            tabIndex={0}
            role="button"
            aria-selected={activeConvId === conv.id && !selectedAgentId}
          >
            <div className="devagents-conv-item-content">
              <div className="devagents-conv-item-title">
                {conv.title.length > 26 ? conv.title.slice(0, 26) + '...' : conv.title}
              </div>
              <div className="devagents-conv-item-meta">
                {conv.messages.filter(m => m.role === 'agent').length > 0 ? t('sidebar.replied') : t('sidebar.pendingReply')}
                {' · '}
                {new Date(conv.updatedAt).toLocaleDateString(i18n.language === 'en-US' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' })}
              </div>
            </div>
            <button
              className="devagents-conv-delete"
              onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
              title={t('sidebar.deleteConv')}
              aria-label={t('sidebar.deleteConv')}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
});

export default ConversationsList;