import { useState } from 'react';
import { X, Search, Plus } from 'lucide-react';

export interface PickerItem {
  id: string;
  name: string;
  description: string;
  source?: string;
}

interface Props {
  title: string;
  items: PickerItem[];
  onSelect: (item: PickerItem) => void;
  onClose: () => void;
}

export default function PickerModal({ title, items, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? items.filter(
        (i) => i.name.toLowerCase().includes(query.toLowerCase()) || i.description.toLowerCase().includes(query.toLowerCase()),
      )
    : items;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="picker-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="picker-modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="picker-modal-search">
          <Search size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索..."
            autoFocus
          />
        </div>

        <div className="picker-modal-list">
          {filtered.length === 0 ? (
            <div className="picker-modal-empty">
              {query ? '无匹配结果' : '暂无可用条目，请先在工作台中创建'}
            </div>
          ) : (
            filtered.map((item) => (
              <button key={item.id} className="picker-modal-item" onClick={() => onSelect(item)}>
                <div className="picker-modal-item-info">
                  <span className="picker-modal-item-name">{item.name}</span>
                  <span className="picker-modal-item-desc">{item.description}</span>
                </div>
                {item.source && <span className="picker-modal-item-source">{item.source}</span>}
                <Plus size={16} className="picker-modal-item-add" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
