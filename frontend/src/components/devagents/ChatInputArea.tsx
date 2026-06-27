import { memo, forwardRef, useState, useCallback, useMemo, useEffect } from 'react';
import { InputToolbar, type AttachedFile, type InputToolbarHandle } from '../input';
import type { CommandOption } from '../../types/input';
import type { Team } from '../../types/devagents';
import { useCommands, useAvailableModels } from '../../api/hooks';
import { useAgentCommands } from '../../hooks/useAgentCommands';

interface ChatInputAreaProps {
  visible: boolean;
  onSend: (text: string, files: AttachedFile[], model: string) => void;
  onConfigureModels?: () => void;
  isRunning?: boolean;
  onStop?: () => void;
  /** Teams with configured agents — used to derive agent MCP/skill commands */
  teams?: Team[];
}

/**
 * Input area wrapper — owns model selection + commands and bridges InputToolbar to the page.
 *
 * Data sources:
 *   - models   → useAvailableModels() from GET /api/models
 *   - commands → useCommands() from GET /api/commands + agent MCP/skills
 */
const ChatInputArea = memo(
  forwardRef<InputToolbarHandle, ChatInputAreaProps>(function ChatInputArea(
    { visible, onSend, onConfigureModels, isRunning, onStop, teams = [] },
    ref,
  ) {
    const [selectedModel, setSelectedModel] = useState(() => {
      try {
        return localStorage.getItem('devagents-selected-model') || '';
      } catch {
        return '';
      }
    });

    const { data: apiCommands } = useCommands();
    const models = useAvailableModels();
    const agentCommands = useAgentCommands(teams);

    // Merge built-in commands + agent MCP/skills + agent tools
    const commands: CommandOption[] = useMemo(() => {
      const builtin: CommandOption[] = (apiCommands ?? [])
        .filter((c) => c.enabled !== false)
        .map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          source: 'local' as const,
        }));
      return [...builtin, ...agentCommands];
    }, [apiCommands, agentCommands]);

    // Auto-select first model when list loads (side-effect, not render-time)
    useEffect(() => {
      if (!selectedModel && models.length > 0) {
        setSelectedModel(models[0].id);
      }
    }, [selectedModel, models]);

    // Listen for model changes from ApiManagementModal
    useEffect(() => {
      const handler = () => {
        try {
          const stored = localStorage.getItem('devagents-selected-model');
          if (stored) setSelectedModel(stored);
        } catch { /* non-fatal */ }
      };
      window.addEventListener('devagents-model-changed', handler);
      return () => window.removeEventListener('devagents-model-changed', handler);
    }, []);

    const handleModelChange = useCallback((id: string) => {
      setSelectedModel(id);
      try {
        localStorage.setItem('devagents-selected-model', id);
      } catch { /* non-fatal */ }
    }, []);

    const handleSend = useCallback(
      (text: string, files: AttachedFile[]) => {
        onSend(text, files, selectedModel);
      },
      [onSend, selectedModel],
    );

    if (!visible) return null;

    return (
      <InputToolbar
        ref={ref}
        onSend={handleSend}
        models={models}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        onConfigureModels={onConfigureModels}
        commands={commands}
        isRunning={isRunning}
        onStop={onStop}
      />
    );
  }),
);

export default ChatInputArea;
