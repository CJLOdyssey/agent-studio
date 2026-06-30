import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModelOption } from '../../types/input';

interface Props {
  models: ModelOption[];
  selectedModel: string;
  onChange: (id: string) => void;
  /** Called when the user clicks the selector while no models are available */
  onConfigure?: () => void;
}

export default function ModelSelector({ models, selectedModel, onChange, onConfigure }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = models.find((m) => m.id === selectedModel);
  const isEmpty = models.length === 0;

  // Memoize grouped models — not called in render path anymore
  const providers = useMemo(() => {
    const g: Record<string, ModelOption[]> = {};
    for (const m of models) (g[m.provider] ??= []).push(m);
    return Object.entries(g);
  }, [models]);

  // All options flattened for keyboard navigation
  const allOptions = useMemo(() => providers.flatMap(([, list]) => list), [providers]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusIdx(-1);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // Keyboard navigation + Escape close
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setOpen(false);
          setFocusIdx(-1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusIdx((i) => Math.min(i + 1, allOptions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusIdx((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusIdx >= 0 && focusIdx < allOptions.length) {
            onChange(allOptions[focusIdx].id);
            setOpen(false);
            setFocusIdx(-1);
          }
          break;
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, focusIdx, allOptions, onChange]);

  // Scroll focused item into view
  useEffect(() => {
    if (!open || focusIdx < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-model-option]');
    items[focusIdx]?.scrollIntoView({ block: 'nearest' });
  }, [open, focusIdx]);

  const handleSelect = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
      setFocusIdx(-1);
    },
    [onChange],
  );

  return (
    <div className="agentstudio-model-selector" ref={ref}>
      <button
        className={`agentstudio-model-trigger ${isEmpty ? 'agentstudio-model-trigger-empty' : ''}`}
        onClick={() => {
          if (isEmpty) {
            onConfigure?.();
          } else {
            setOpen(!open);
            setFocusIdx(-1);
          }
        }}
        type="button"
        title={isEmpty ? t('model.configure') : current?.label}
        aria-expanded={isEmpty ? undefined : open}
        aria-haspopup={isEmpty ? undefined : 'listbox'}
      >
        <span className="agentstudio-model-label">
          {isEmpty ? t('model.configure') : (current?.label ?? t('model.noModels'))}
        </span>
        <ChevronDown size={10} className={`agentstudio-model-chevron ${open ? 'open' : ''}`} />
      </button>

      {open && !isEmpty && (
        <div className="agentstudio-model-popover" ref={listRef} role="listbox">
          {providers.length > 1
            ? providers.map(([provider, list]) => (
                <div key={provider} className="agentstudio-model-group">
                  <div className="agentstudio-model-group-label">{provider}</div>
                  {list.map((m) => {
                    const globalIdx = allOptions.indexOf(m);
                    return (
                      <button
                        key={m.id}
                        data-model-option
                        className={`agentstudio-model-option ${m.id === selectedModel ? 'selected' : ''} ${globalIdx === focusIdx ? 'focused' : ''}`}
                        onClick={() => handleSelect(m.id)}
                        role="option"
                        aria-selected={m.id === selectedModel}
                        type="button"
                      >
                        <span>{m.label}</span>
                        {m.status === 'deprecated' && (
                          <span className="agentstudio-model-status">{t('model.statusDeprecated')}</span>
                        )}
                        {m.status === 'sunset' && (
                          <span className="agentstudio-model-status">{t('model.statusSunset')}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            : models.map((m, idx) => (
                <button
                  key={m.id}
                  data-model-option
                  className={`agentstudio-model-option ${m.id === selectedModel ? 'selected' : ''} ${idx === focusIdx ? 'focused' : ''}`}
                  onClick={() => handleSelect(m.id)}
                  role="option"
                  aria-selected={m.id === selectedModel}
                  type="button"
                >
                  <span>{m.label}</span>
                  {m.status === 'deprecated' && (
                    <span className="agentstudio-model-status">{t('model.statusDeprecated')}</span>
                  )}
                  {m.status === 'sunset' && <span className="agentstudio-model-status">{t('model.statusSunset')}</span>}
                </button>
              ))}
        </div>
      )}
    </div>
  );
}
