import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '../../../../styles/wsta-searchable-select.css';

export interface SearchableSelectProps<T> {
  options: T[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  getOptionId: (opt: T) => string;
  getOptionLabel: (opt: T) => string;
  getOptionSecondary?: (opt: T) => string;
  placeholder?: string;
  searchPlaceholder?: string;
  multiple?: boolean;
  maxDisplay?: number;
}

export default function SearchableSelect<T>({
  options,
  value,
  onChange,
  getOptionId,
  getOptionLabel,
  getOptionSecondary,
  placeholder = '请选择...',
  searchPlaceholder = '搜索...',
  multiple = false,
  maxDisplay = 10,
}: SearchableSelectProps<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedIds = useMemo(() => {
    if (multiple) return new Set(value as string[]);
    return value ? new Set([value as string]) : new Set<string>();
  }, [value, multiple]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => getOptionLabel(o).toLowerCase().includes(q));
  }, [options, query, getOptionLabel]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const selectedItems = useMemo(() => {
    if (multiple) {
      const ids = value as string[];
      return ids.map((id) => options.find((o) => getOptionId(o) === id)).filter(Boolean) as T[];
    }
    const id = value as string;
    if (!id) return [];
    const item = options.find((o) => getOptionId(o) === id);
    return item ? [item] : [];
  }, [options, value, multiple, getOptionId]);

  function handleSelect(opt: T) {
    const id = getOptionId(opt);
    if (multiple) {
      const current = value as string[];
      const next = selectedIds.has(id) ? current.filter((v) => v !== id) : [...current, id];
      onChange(next);
    } else {
      onChange(id);
      setOpen(false);
      setQuery('');
    }
  }

  function handleRemove(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (multiple) {
      onChange((value as string[]).filter((v) => v !== id));
    }
  }

  const selectedLabel = multiple
    ? selectedItems.length > 0
      ? `已选 ${selectedItems.length} 项`
      : placeholder
    : selectedItems.length > 0
      ? getOptionLabel(selectedItems[0])
      : placeholder;

  return (
    <div className="wsta-searchable-select" ref={containerRef}>
      <div className={`wsta-searchable-select-trigger ${open ? 'wsta-searchable-select-open' : ''}`} onClick={() => setOpen((p) => !p)}>
        <div className="wsta-searchable-select-display">
          {multiple && selectedItems.length > 0 && (
            <div className="wsta-searchable-select-tags">
              {selectedItems.slice(0, maxDisplay).map((item) => (
                <span key={getOptionId(item)} className="wsta-searchable-select-tag">
                  {getOptionLabel(item)}
                  <button className="wsta-searchable-select-tag-remove" onClick={(e) => handleRemove(e, getOptionId(item))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              {selectedItems.length > maxDisplay && (
                <span className="wsta-searchable-select-tag wsta-searchable-select-tag-more">+{selectedItems.length - maxDisplay}</span>
              )}
            </div>
          )}
          {(!multiple || selectedItems.length === 0) && (
            <span className={selectedItems.length > 0 ? 'wsta-searchable-select-label' : 'wsta-searchable-select-placeholder'}>{selectedLabel}</span>
          )}
        </div>
        <ChevronDown size={14} className={`wsta-searchable-select-chevron ${open ? 'wsta-searchable-select-chevron-up' : ''}`} />
      </div>

      {open && (
        <div className="wsta-searchable-select-dropdown">
          <div className="wsta-searchable-select-search" onMouseDown={(e) => e.stopPropagation()}>
            <Search size={14} className="wsta-searchable-select-search-icon" />
            <input
              ref={inputRef}
              className="wsta-searchable-select-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="wsta-searchable-select-options">
            {filtered.length === 0 ? (
              <div className="wsta-searchable-select-no-results">      {t('workstation.noMatch')}</div>
            ) : (
              filtered.map((opt) => {
                const id = getOptionId(opt);
                const selected = selectedIds.has(id);
                return (
                  <div
                    key={id}
                    className={`wsta-searchable-select-option ${selected ? 'wsta-searchable-select-option-selected' : ''}`}
                    onClick={() => handleSelect(opt)}
                  >
                    <div className="wsta-searchable-select-option-main">
                      {multiple && (
                        <span className={`wsta-searchable-select-checkbox ${selected ? 'wsta-searchable-select-checkbox-on' : ''}`}>
                          {selected && '✓'}
                        </span>
                      )}
                      <span className="wsta-searchable-select-option-label">{getOptionLabel(opt)}</span>
                    </div>
                    {getOptionSecondary && (
                      <span className="wsta-searchable-select-option-secondary">{getOptionSecondary(opt)}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}


    </div>
  );
}
