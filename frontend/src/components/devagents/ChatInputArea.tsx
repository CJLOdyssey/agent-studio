import React, { memo } from 'react';
import { Send, Paperclip, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../contexts/SettingsContext';

const MODELS = [
  { id: 'deepseek-chat', label: 'DeepSeek Chat', provider: 'DeepSeek' },
  { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', provider: 'DeepSeek' },
  { id: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', provider: 'Anthropic' },
];

interface ChatInputAreaProps {
  selectedAgentId: string | null;
  homeMessagesLength: number;
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSendMessage: () => void;
  textareaRef: React.Ref<HTMLTextAreaElement>;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const ChatInputArea = memo(function ChatInputArea({
  selectedAgentId,
  homeMessagesLength,
  inputValue,
  setInputValue,
  handleSendMessage,
  textareaRef,
  selectedModel,
  onModelChange,
}: ChatInputAreaProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();

  if (!selectedAgentId && homeMessagesLength === 0) return null;
  const currentModel = MODELS.find(m => m.id === selectedModel);

  return (
    <div className="devagents-input-area">
      <div className="devagents-input-inner">
        <div className="devagents-input-wrapper">
          <textarea
            ref={textareaRef}
            className="devagents-textarea"
            placeholder={t('chat.input.placeholder')}
            value={inputValue}
            maxLength={10000}
            aria-label={t('chat.input.placeholder')}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              const isSendKey = settings.sendMode === 'enter' ? (e.key === 'Enter' && !e.shiftKey) : (e.key === 'Enter' && (e.ctrlKey || e.metaKey));
              if (isSendKey) { e.preventDefault(); handleSendMessage(); }
            }}
          />
          <div className="devagents-input-toolbar">
            <div className="devagents-input-tools">
              <div className="devagents-model-selector">
                <select
                  className="devagents-model-select"
                  value={selectedModel}
                  onChange={(e) => onModelChange(e.target.value)}
                  title={`当前模型: ${currentModel?.label || selectedModel}`}
                >
                  {MODELS.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.provider} - {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="devagents-model-chevron" />
              </div>
              <button className="devagents-tool-btn" title={t('home.attach')} aria-label={t('home.attach')}>
                <Paperclip size={16} />
              </button>
              <button className="devagents-tool-btn-text" aria-label={t('home.commands')}>{t('home.commands')}</button>
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className={`devagents-send-btn ${inputValue.trim() ? 'active' : 'disabled'}`}
            >
              <span>{t('home.send')}</span>
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ChatInputArea;
