import { useState, useMemo } from 'react';
import { X, Search, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface ResourcePickerModalProps<T> {
  title: string;
  options: T[];
  selectedIds: string | string[];
  onConfirm: (ids: string | string[]) => void;
  onClose: () => void;
  getOptionId: (opt: T) => string;
  getOptionLabel: (opt: T) => string;
  getOptionSecondary?: (opt: T) => string;
  searchPlaceholder?: string;
  multiple?: boolean;
}

export default function ResourcePickerModal<T>({
  title,
  options,
  selectedIds,
  onConfirm,
  onClose,
  getOptionId,
  getOptionLabel,
  getOptionSecondary,
  searchPlaceholder = '搜索...',
  multiple = false,
}: ResourcePickerModalProps<T>) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [tempSelected, setTempSelected] = useState<Set<string>>(() => {
    if (multiple) return new Set(selectedIds as string[]);
    return selectedIds ? new Set([selectedIds as string]) : new Set<string>();
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => getOptionLabel(o).toLowerCase().includes(q));
  }, [options, query, getOptionLabel]);

  function handleToggle(opt: T) {
    const id = getOptionId(opt);
    if (multiple) {
      setTempSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setTempSelected(new Set([id]));
    }
  }

  function handleConfirm() {
    if (multiple) {
      onConfirm(Array.from(tempSelected));
    } else {
      const id = Array.from(tempSelected)[0] || '';
      onConfirm(id);
    }
  }

  return (
    <div className="fixed inset-0 bg-[var(--da-overlay-bg)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--da-bg-secondary)] rounded-xl w-[90%] max-h-[85vh] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)] max-w-[var(--modal-m)] max-h-[calc(100vh/1.618)] overflow-hidden max-w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--da-border-subtle)]">
          <h3>{title}</h3>
          <button className="bg-transparent border-none text-[var(--da-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 py-2 px-3 bg-[var(--da-bg-surface)] border border-[var(--da-border)] rounded-md mb-3">
            <Search size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-y-auto border border-[var(--da-border)] rounded-md">
            {filtered.length === 0 && (
              <div className="p-6 text-center text-[var(--da-text-muted)] text-sm">{t('workstation.noMatch')}</div>
            )}
            {filtered.map((opt) => {
              const id = getOptionId(opt);
              const isSelected = tempSelected.has(id);
              return (
                <div
                  key={id}
                  className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors duration-150 border-b border-[var(--da-border-subtle)] last:border-b-0 hover:bg-[var(--da-bg-surface-hover)] ${isSelected ? 'bg-[color-mix(in_srgb,var(--da-accent-indigo)_10%,transparent)]' : ''}`}
                  onClick={() => handleToggle(opt)}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="text-sm text-[var(--da-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis">{getOptionLabel(opt)}</div>
                    {getOptionSecondary && (
                      <div className="text-xs text-[var(--da-text-muted)]">{getOptionSecondary(opt)}</div>
                    )}
                  </div>
                  {isSelected && <Check size={16} className="text-[var(--da-accent-indigo)] shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--da-border-subtle)]" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--da-font-size-xs)', color: 'var(--da-text-muted)' }}>
            {multiple && tempSelected.size > 0 ? `${t('workstation.selectedCount')}: ${tempSelected.size}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-surface)] text-[var(--da-text-secondary)] hover:bg-[var(--da-bg-hover)] hover:text-[var(--da-text-primary)]" onClick={onClose}>{t('workstation.cancel')}</button>
            <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--da-bg-hover)] text-[var(--da-text-primary)] hover:bg-[var(--da-bg-elevated)] disabled:bg-[var(--da-bg-hover)] disabled:text-[var(--da-text-muted)] disabled:cursor-not-allowed" onClick={handleConfirm}>
              {multiple && tempSelected.size > 0
                ? `${t('workstation.confirm')} (${tempSelected.size})`
                : t('workstation.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
