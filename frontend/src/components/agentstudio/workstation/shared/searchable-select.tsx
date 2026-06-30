import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';

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
              <div className="wsta-searchable-select-no-results">无匹配结果</div>
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

      <style>{`
        .wsta-searchable-select {
          position: relative;
          width: 100%;
        }

        .wsta-searchable-select-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 12px;
          background: var(--da-bg-surface);
          border: 1px solid var(--da-border);
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          min-height: 38px;
        }

        .wsta-searchable-select-trigger:hover {
          border-color: var(--da-border-strong);
        }

        .wsta-searchable-select-open {
          border-color: var(--da-accent-indigo);
          box-shadow: 0 0 0 2px color-mix(in srgb, var(--da-accent-indigo) 20%, transparent);
        }

        .wsta-searchable-select-display {
          flex: 1;
          display: flex;
          align-items: center;
          min-width: 0;
        }

        .wsta-searchable-select-placeholder {
          color: var(--da-text-muted);
          font-size: var(--da-font-size-sm);
        }

        .wsta-searchable-select-label {
          color: var(--da-text-primary);
          font-size: var(--da-font-size-sm);
          font-weight: 500;
        }

        .wsta-searchable-select-chevron {
          flex-shrink: 0;
          color: var(--da-text-muted);
          transition: transform 0.2s ease;
        }

        .wsta-searchable-select-chevron-up {
          transform: rotate(180deg);
        }

        .wsta-searchable-select-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .wsta-searchable-select-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background: color-mix(in srgb, var(--da-accent-indigo) 15%, transparent);
          color: var(--da-accent-indigo);
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
        }

        .wsta-searchable-select-tag-more {
          background: var(--da-bg-hover);
          color: var(--da-text-secondary);
        }

        .wsta-searchable-select-tag-remove {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0;
          opacity: 0.7;
          transition: opacity 0.15s;
        }

        .wsta-searchable-select-tag-remove:hover {
          opacity: 1;
        }

        .wsta-searchable-select-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: var(--da-bg-elevated);
          border: 1px solid var(--da-border);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
          z-index: var(--z-dropdown, 100);
          overflow: hidden;
        }

        .wsta-searchable-select-search {
          position: relative;
          display: flex;
          align-items: center;
          padding: 8px;
          border-bottom: 1px solid var(--da-border);
        }

        .wsta-searchable-select-search-icon {
          position: absolute;
          left: 14px;
          color: var(--da-text-muted);
          pointer-events: none;
        }

        .wsta-searchable-select-search-input {
          width: 100%;
          padding: 6px 8px 6px 28px;
          background: var(--da-bg-surface);
          border: 1px solid var(--da-border);
          border-radius: 6px;
          color: var(--da-text-primary);
          font-size: var(--da-font-size-sm);
          outline: none;
        }

        .wsta-searchable-select-search-input:focus {
          border-color: var(--da-accent-indigo);
        }

        .wsta-searchable-select-options {
          max-height: 220px;
          overflow-y: auto;
          padding: 4px;
        }

        .wsta-searchable-select-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.12s;
        }

        .wsta-searchable-select-option:hover {
          background: var(--da-bg-hover);
        }

        .wsta-searchable-select-option-selected {
          background: color-mix(in srgb, var(--da-accent-indigo) 10%, transparent);
        }

        .wsta-searchable-select-option-main {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .wsta-searchable-select-checkbox {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border: 1.5px solid var(--da-border-strong);
          border-radius: 4px;
          font-size: 11px;
          flex-shrink: 0;
          transition: all 0.15s;
        }

        .wsta-searchable-select-checkbox-on {
          background: var(--da-accent-indigo);
          border-color: var(--da-accent-indigo);
          color: white;
        }

        .wsta-searchable-select-option-label {
          font-size: var(--da-font-size-sm);
          color: var(--da-text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .wsta-searchable-select-option-secondary {
          font-size: var(--da-font-size-xs);
          color: var(--da-text-muted);
          flex-shrink: 0;
          margin-left: 8px;
        }

        .wsta-searchable-select-no-results {
          padding: 16px;
          text-align: center;
          color: var(--da-text-muted);
          font-size: var(--da-font-size-sm);
        }
      `}</style>
    </div>
  );
}
