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
    <div className="relative inline-flex items-center" ref={ref}>
      <button
        className={`inline-flex items-center gap-1 px-2 py-1 border rounded-md bg-transparent text-xs font-[inherit] cursor-pointer transition-all duration-150 max-w-[180px] ${isEmpty ? 'border-[var(--da-accent-amber)] text-[var(--da-accent-amber)] hover:bg-[color-mix(in_srgb,var(--da-accent-amber)_10%,transparent)] hover:border-[var(--da-accent-amber)] hover:text-[var(--da-accent-amber)]' : 'border-[var(--da-border-subtle)] text-[var(--da-text-secondary)] hover:border-[var(--da-border)] hover:text-[var(--da-text-primary)]'}`}
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
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
          {isEmpty ? t('model.configure') : (current?.label ?? t('model.noModels'))}
        </span>
        <ChevronDown size={10} className={`flex-shrink-0 text-[var(--da-text-muted)] transition-transform duration-150 ease ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !isEmpty && (
        <div className="absolute bottom-[calc(100%+8px)] left-0 min-w-[200px] bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-[10px] shadow-[0_12px_40px_rgba(0,0,0,0.25)] z-[500] p-1" ref={listRef} role="listbox">
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
                        className={`flex items-center justify-between w-full px-3 py-2 border-none rounded-md bg-transparent text-[var(--da-text-primary)] text-sm cursor-pointer transition-colors duration-100 text-left hover:bg-[var(--da-bg-hover)] ${m.id === selectedModel ? 'bg-[color-mix(in_srgb,var(--da-accent-indigo)_12%,transparent)] text-[var(--da-accent-indigo)]' : ''} ${globalIdx === focusIdx ? 'outline-2 outline-[var(--da-accent-indigo)] outline-offset-[-2px]' : ''}`}
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
                  className={`flex items-center justify-between w-full px-3 py-2 border-none rounded-md bg-transparent text-[var(--da-text-primary)] text-sm cursor-pointer transition-colors duration-100 text-left hover:bg-[var(--da-bg-hover)] ${m.id === selectedModel ? 'bg-[color-mix(in_srgb,var(--da-accent-indigo)_12%,transparent)] text-[var(--da-accent-indigo)]' : ''} ${idx === focusIdx ? 'outline-2 outline-[var(--da-accent-indigo)] outline-offset-[-2px]' : ''}`}
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
