import { useState, useMemo } from 'react';
import { Search, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/shared/Modal';

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
    <Modal
      title={title}
      onClose={onClose}
      hideHeaderBorder
      hideFooterBorder
      width={420}
      bodyClassName="p-5"
      footer={
        <div className="w-full flex items-center justify-between gap-2">
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {multiple && tempSelected.size > 0 ? `${t('workstation.selectedCount')}: ${tempSelected.size}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('workstation.cancel')}</button>
            <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed" onClick={handleConfirm}>
              {multiple && tempSelected.size > 0
                ? `${t('workstation.confirm')} (${tempSelected.size})`
                : t('workstation.confirm')}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex items-center gap-2 py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md mb-3 transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_2px_var(--color-accent)]">
        <Search size={16} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          autoFocus
          className="flex-1 min-w-0 bg-transparent border-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          style={{ outline: 'none', boxShadow: 'none', WebkitBoxShadow: 'none' }}

        />
      </div>
      <div className="max-h-80 overflow-y-auto border border-[var(--color-border)] rounded-md">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-[var(--color-text-muted)] text-sm">{t('workstation.noMatch')}</div>
        )}
        {filtered.map((opt) => {
          const id = getOptionId(opt);
          const isSelected = tempSelected.has(id);
          return (
            <div
              key={id}
              className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors duration-150 border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-hover)] ${isSelected ? 'bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]' : ''}`}
              onClick={() => handleToggle(opt)}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="text-sm text-[var(--color-text-primary)] whitespace-nowrap overflow-hidden text-ellipsis">{getOptionLabel(opt)}</div>
                {getOptionSecondary && (
                  <div className="text-xs text-[var(--color-text-muted)]">{getOptionSecondary(opt)}</div>
                )}
              </div>
              {isSelected && <Check size={16} className="text-[var(--color-accent)] shrink-0" />}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
