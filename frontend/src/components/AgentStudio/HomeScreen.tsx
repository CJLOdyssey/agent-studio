import { useTranslation } from 'react-i18next';

import type { ModelOption, AttachedFile, CommandOption } from '../../types/input';
import GreetingAnimation from './GreetingAnimation';
import { InputToolbar, type InputToolbarHandle } from '../input';
import type { RefObject } from 'react';
import { AgentStudioLogo } from '../shared/AgentStudioLogo';

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
            <div className="w-[72px] h-[72px] mx-auto mb-6 flex items-center justify-center">
              <AgentStudioLogo size={48} />
            </div>
            <GreetingAnimation key={conversationKey} />
            <p className="text-base text-[var(--color-text-muted)] m-0">{t('home.subtitle')}</p>
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
        </div>
      </div>
    </div>
  );
}