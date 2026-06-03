import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandOption } from '../../types/input';

interface Props {
  commands: CommandOption[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  onClose: () => void;
}

/**
 * Inline command palette popover — shown when user types '/' in the textarea.
 *
 * Renders filtered commands with keyboard-driven highlight.
 * Positioned above the textarea toolbar.
 */
export default function CommandDropdown({ commands, activeIndex, onSelect, onHover, onClose }: Props) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-cmd-option]');
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleClick = useCallback(
    (index: number) => {
      onSelect(index);
    },
    [onSelect],
  );

  if (commands.length === 0) {
    return (
      <div className="devagents-command-popover" ref={ref}>
        <div className="devagents-command-empty">{t('model.noCommands')}</div>
      </div>
    );
  }

  return (
    <div className="devagents-command-popover" ref={ref} role="listbox">
      <div ref={listRef}>
        {commands.map((opt, idx) => (
          <button
            key={opt.id}
            data-cmd-option
            className={`devagents-command-option ${idx === activeIndex ? 'focused' : ''}`}
            onClick={() => handleClick(idx)}
            onMouseEnter={() => onHover(idx)}
            role="option"
            aria-selected={idx === activeIndex}
            type="button"
          >
            <span className="devagents-command-option-name">/{opt.name}</span>
            {opt.source === 'agent' && (
              <span className="devagents-command-option-source">Agent</span>
            )}
            {opt.description && (
              <span className="devagents-command-option-desc">{opt.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
