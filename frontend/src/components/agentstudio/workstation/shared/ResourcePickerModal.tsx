import { useState, useMemo } from 'react';
import { X, Search, Check } from 'lucide-react';

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wsta-modal wsta-modal-md" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="wsta-picker-search">
            <Search size={16} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
            />
          </div>
          <div className="wsta-picker-list">
            {filtered.length === 0 && (
              <div className="wsta-picker-empty">无匹配结果</div>
            )}
            {filtered.map((opt) => {
              const id = getOptionId(opt);
              const isSelected = tempSelected.has(id);
              return (
                <div
                  key={id}
                  className={`wsta-picker-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleToggle(opt)}
                >
                  <div className="wsta-picker-item-info">
                    <div className="wsta-picker-item-label">{getOptionLabel(opt)}</div>
                    {getOptionSecondary && (
                      <div className="wsta-picker-item-secondary">{getOptionSecondary(opt)}</div>
                    )}
                  </div>
                  {isSelected && <Check size={16} className="wsta-picker-item-check" />}
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={handleConfirm}>确认</button>
        </div>
      </div>
    </div>
  );
}
