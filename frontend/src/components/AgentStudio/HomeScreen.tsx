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
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div className="w-full max-w-[900px] flex flex-col items-center justify-center px-6">
         <div className="flex flex-col items-center w-full">
          <div className="text-center mb-8">
            <div className="w-[72px] h-[72px] mx-auto mb-6 bg-[var(--da-bg-surface)] rounded-xl flex items-center justify-center" role="img" tabIndex={-1} aria-label="AgentStudio Logo">
              <Bot size={48} className="text-[var(--icon-planning)]" />
            </div>
            <GreetingAnimation key={conversationKey} />
            <p className="text-base text-[var(--da-text-muted)] m-0">{t('home.subtitle')}</p>
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
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[var(--da-border)] rounded-md text-[var(--da-text-secondary)] text-xs cursor-pointer transition-colors duration-150 whitespace-nowrap hover:text-[var(--da-text-primary)] hover:bg-[var(--da-bg-hover)] hover:border-[var(--da-border-strong)]" onClick={() => onExecuteCommand?.('search')}>
              <Search size={14} />
              <span>{t('features.search', '搜索')}</span>
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[var(--da-border)] rounded-md text-[var(--da-text-secondary)] text-xs cursor-pointer transition-colors duration-150 whitespace-nowrap hover:text-[var(--da-text-primary)] hover:bg-[var(--da-bg-hover)] hover:border-[var(--da-border-strong)]" onClick={() => onExecuteCommand?.('data')}>
              <BarChart3 size={14} />
              <span>{t('features.data', '数据')}</span>
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[var(--da-border)] rounded-md text-[var(--da-text-secondary)] text-xs cursor-pointer transition-colors duration-150 whitespace-nowrap hover:text-[var(--da-text-primary)] hover:bg-[var(--da-bg-hover)] hover:border-[var(--da-border-strong)]" onClick={() => onExecuteCommand?.('document')}>
              <FileText size={14} />
              <span>{t('features.document', '文档')}</span>
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[var(--da-border)] rounded-md text-[var(--da-text-secondary)] text-xs cursor-pointer transition-colors duration-150 whitespace-nowrap hover:text-[var(--da-text-primary)] hover:bg-[var(--da-bg-hover)] hover:border-[var(--da-border-strong)]" onClick={() => onExecuteCommand?.('image')}>
              <Image size={14} />
              <span>{t('features.image', '图片')}</span>
            </button>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-transparent border border-[var(--da-border)] rounded-md text-[var(--da-text-secondary)] text-xs cursor-pointer transition-colors duration-150 whitespace-nowrap hover:text-[var(--da-text-primary)] hover:bg-[var(--da-bg-hover)] hover:border-[var(--da-border-strong)]" onClick={() => onExecuteCommand?.('more')}>
              <MoreHorizontal size={14} />
              <span>{t('features.more', '更多')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
