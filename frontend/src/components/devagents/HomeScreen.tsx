import { useTranslation } from 'react-i18next';
import { Bot, Search, BarChart3, FileText, Image, MoreHorizontal } from 'lucide-react';
import type { ModelOption, AttachedFile, CommandOption } from '../../types/input';
import GreetingAnimation from './GreetingAnimation';
import { InputToolbar, type InputToolbarHandle } from '../input';
import type { RefObject } from 'react';

interface Props {
  conversationKey: number;
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (id: string) => void;
  commands: CommandOption[];
  onSend: (text: string, files: AttachedFile[]) => void;
  onExecuteCommand?: (commandId: string) => void;
  onConfigureModels?: () => void;
  inputToolbarRef: RefObject<InputToolbarHandle>;
  isRunning?: boolean;
  onStop?: () => void;
}

export default function HomeScreen({
  conversationKey,
  models,
  selectedModel,
  onModelChange,
  commands,
  onSend,
  onExecuteCommand,
  onConfigureModels,
  inputToolbarRef,
  isRunning,
  onStop,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="devagents-home">
      <div className="devagents-home-centered">
        <div className="devagents-home-group">
          <div className="devagents-home-hero">
            <div className="devagents-home-logo" role="img" tabIndex={-1} aria-label="DevAgents Logo">
              <Bot size={48} className="devagents-home-logo-icon" />
            </div>
            <GreetingAnimation key={conversationKey} />
            <p className="devagents-home-subtitle">{t('home.subtitle')}</p>
          </div>
          <InputToolbar
            ref={inputToolbarRef}
            onSend={onSend}
            models={models}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            placeholder={t('home.placeholder')}
            commands={commands}
            onExecuteCommand={onExecuteCommand}
            onConfigureModels={onConfigureModels}
            isRunning={isRunning}
            onStop={onStop}
          />
          <div className="devagents-input-features">
            <button className="devagents-feature-btn" onClick={() => onExecuteCommand?.('search')}>
              <Search size={14} />
              <span>{t('features.search', '搜索')}</span>
            </button>
            <button className="devagents-feature-btn" onClick={() => onExecuteCommand?.('data')}>
              <BarChart3 size={14} />
              <span>{t('features.data', '数据')}</span>
            </button>
            <button className="devagents-feature-btn" onClick={() => onExecuteCommand?.('document')}>
              <FileText size={14} />
              <span>{t('features.document', '文档')}</span>
            </button>
            <button className="devagents-feature-btn" onClick={() => onExecuteCommand?.('image')}>
              <Image size={14} />
              <span>{t('features.image', '图片')}</span>
            </button>
            <button className="devagents-feature-btn" onClick={() => onExecuteCommand?.('more')}>
              <MoreHorizontal size={14} />
              <span>{t('features.more', '更多')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
