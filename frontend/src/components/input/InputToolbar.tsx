import { useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModelOption, AttachedFile, CommandOption, FileRejection } from '../../types/input';
import ModelSelector from './ModelSelector';
import FileAttach from './FileAttach';
import CommandDropdown from './CommandDropdown';
import { useMessageComposer } from '../../hooks/useMessageComposer';
import { useCommandPalette } from '../../hooks/useCommandPalette';
import { useToast } from '../../utils/useToast';

export interface InputToolbarHandle {
  addFiles: (files: File[]) => void;
}

interface InputToolbarProps {
  onSend: (text: string, files: AttachedFile[]) => void;
  models: ModelOption[];
  selectedModel: string;
  onModelChange: (id: string) => void;
  onConfigureModels?: () => void;
  onExecuteCommand?: (commandId: string) => void;
  commands?: CommandOption[];
  placeholder?: string;
  maxLength?: number;
}

const MAX_FILES = 5;

const InputToolbar = forwardRef<InputToolbarHandle, InputToolbarProps>(function InputToolbar(
  {
    onSend,
    models,
    selectedModel,
    onModelChange,
    onConfigureModels,
    onExecuteCommand,
    commands = [],
    placeholder,
    maxLength = 10000,
  },
  ref,
) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [files, setFiles] = useState<AttachedFile[]>([]);

  const composer = useMessageComposer({
    onSend: (text) => {
      onSend(text, files);
      setFiles([]);
    },
    maxLength,
  });

  // ── Slash-command palette ──

  const palette = useCommandPalette(commands);

  const handleCommandSelect = useCallback(
    (index: number) => {
      if (index < 0 || index >= palette.filtered.length) return;
      const cmd = palette.filtered[index];
      if (cmd.source === 'local' && onExecuteCommand) {
        palette.close();
        onExecuteCommand(cmd.id);
        return;
      }
      const replacement = palette.selectCommand(index);
      if (replacement) composer.setValue(replacement);
    },
    [palette, composer, onExecuteCommand],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Let palette intercept first (arrow keys, Enter, Escape when open)
      const handled = palette.handleKeyDown(e, composer.value);
      if (handled) {
        if (e.key === 'Enter' && !e.shiftKey && palette.open) {
          handleCommandSelect(palette.activeIndex);
        }
        return;
      }
      // Fall through to composer (Enter to send, etc.)
      composer.handleKeyDown(e);
    },
    [palette, composer, handleCommandSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      composer.setValue(e.target.value);
      palette.updateFromValue(e.target.value);
    },
    [composer, palette],
  );

  // ── File handling ──

  const addFiles = useCallback(
    (incoming: File[]) => {
      setFiles((prev) => {
        const now = Date.now();
        const mapped: AttachedFile[] = incoming.map((f, i) => ({
          id: `${now}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          name: f.name,
          size: f.size,
          type: f.type,
          file: f,
        }));
        const merged = [...prev, ...mapped].slice(0, MAX_FILES);
        if (merged.length < prev.length + mapped.length) {
          toast(`最多附加 ${MAX_FILES} 个文件`, 'info');
        }
        return merged;
      });
    },
    [toast],
  );

  useImperativeHandle(ref, () => ({ addFiles }), [addFiles]);

  const handleReject = useCallback(
    (rejections: FileRejection[]) => {
      for (const r of rejections) {
        if (r.reason === 'size_exceeded') {
          toast(`"${r.file.name}" 超过 50MB 限制`, 'error');
        } else {
          toast(`"${r.file.name}" 格式不支持`, 'error');
        }
      }
    },
    [toast],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (e.clipboardData.files.length > 0) {
        e.preventDefault();
        addFiles(Array.from(e.clipboardData.files));
      }
    },
    [addFiles],
  );

  return (
    <div className="devagents-input-container">
      <div className="devagents-input-wrapper">
        {palette.open && (
          <CommandDropdown
            commands={palette.filtered}
            activeIndex={palette.activeIndex}
            onSelect={handleCommandSelect}
            onHover={palette.setActiveIndex}
            onClose={palette.close}
          />
        )}

        <textarea
          className="devagents-textarea"
          placeholder={placeholder ?? t('home.placeholder')}
          value={composer.value}
          maxLength={maxLength}
          aria-label={placeholder ?? t('home.placeholder')}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
        />

        <div className="devagents-input-toolbar">
          <div className="devagents-input-tools">
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onChange={onModelChange}
              onConfigure={onConfigureModels}
            />
            <FileAttach onAdd={addFiles} onReject={handleReject} fileCount={files.length} />
          </div>

          <button
            onClick={composer.submit}
            disabled={!composer.hasContent}
            className={`devagents-send-btn ${composer.hasContent ? 'active' : 'disabled'}`}
            aria-label={t('home.send')}
          >
            <span>{t('home.send')}</span>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
});

export default InputToolbar;
