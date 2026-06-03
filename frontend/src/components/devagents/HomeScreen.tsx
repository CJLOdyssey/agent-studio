import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
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
}

export default function HomeScreen({ conversationKey, models, selectedModel, onModelChange, commands, onSend, onExecuteCommand, onConfigureModels, inputToolbarRef }: Props) {
  const { t } = useTranslation();
  return (
    <div className="devagents-home">
      <div className="devagents-home-centered">
        <div className="devagents-home-group">
          <div className="devagents-home-hero">
            <div className="devagents-home-logo" role="img" tabIndex={-1} aria-label="DevAgents Logo">
              <Bot size={48} className="text-[var(--icon-planning)]" />
            </div>
            <GreetingAnimation key={conversationKey} />
            <p className="devagents-home-subtitle">{t('home.subtitle')}</p>
          </div>
          <InputToolbar ref={inputToolbarRef} onSend={onSend} models={models}
            selectedModel={selectedModel} onModelChange={onModelChange}
            placeholder={t('chatInput.placeholder')} commands={commands}
            onExecuteCommand={onExecuteCommand} onConfigureModels={onConfigureModels} />
        </div>
      </div>
    </div>
  );
}
