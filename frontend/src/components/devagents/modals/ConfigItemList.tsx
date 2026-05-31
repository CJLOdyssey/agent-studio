import { Plus, Trash2, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ListItem {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

interface Props<T extends ListItem> {
  title: string;
  items: T[];
  presets: { id: string; name: string; description?: string }[];
  editingId: string | null;
  emptyLabel: string;
  onToggle: (id: string) => void;
  onAdd: () => void;
  onUpdate: (id: string, name: string, desc: string) => void;
  onRemove: (id: string) => void;
  onStartEdit: (id: string) => void;
  onFinishEdit: () => void;
}

export default function ConfigItemList<T extends ListItem>({
  title, items, presets, editingId, emptyLabel,
  onToggle, onAdd, onUpdate, onRemove, onStartEdit, onFinishEdit,
}: Props<T>) {
  const { t } = useTranslation();
  return (
    <div className="agent-config-list">
      <div className="agent-config-list-header">
        <span>{title} ({items.length})</span>
        <button className="btn btn-sm btn-secondary" onClick={onAdd}>
          <Plus size={14} /> {t('configItem.add')}
        </button>
      </div>
      <div className="agent-config-items">
        {items.map(item => (
          <div key={item.id} className={`agent-config-item ${item.enabled ? 'enabled' : ''}`}>
            <div className="agent-config-item-info">
              <input type="checkbox" checked={item.enabled} onChange={() => onToggle(item.id)} />
              <div className="agent-config-item-details">
                {editingId === item.id ? (
                  <ConfigItemEdit item={item} onUpdate={onUpdate} onFinishEdit={onFinishEdit} />
                ) : (
                  <>
                    <span className="agent-config-item-name">{item.name}</span>
                    {item.description && <span className="agent-config-item-desc">{item.description}</span>}
                  </>
                )}
              </div>
            </div>
            <div className="agent-config-item-actions">
              {editingId !== item.id && (
                <button className="agent-config-item-action" onClick={() => onStartEdit(item.id)} title={t('configItem.add')}>
                  <Pencil size={14} />
                </button>
              )}
              <button className="agent-config-item-remove" onClick={() => onRemove(item.id)} title="删除">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {presets.filter(p => !items.some(i => i.id === p.id)).map(p => (
          <div key={p.id} className="agent-config-item">
            <div className="agent-config-item-info">
              <div className="agent-config-item-details">
                <span className="agent-config-item-name">{p.name}</span>
                {p.description && <span className="agent-config-item-desc">{p.description}</span>}
              </div>
            </div>
            <div className="agent-config-item-actions">
              <button className="agent-config-item-action" onClick={() => onToggle(p.id)}><Plus size={14} /></button>
            </div>
          </div>
        ))}
        {items.length === 0 && presets.length === 0 && (
          <div className="agent-config-empty">{emptyLabel}</div>
        )}
      </div>
    </div>
  );
}

function ConfigItemEdit<T extends ListItem>({ item, onUpdate, onFinishEdit }: {
  item: T;
  onUpdate: (id: string, name: string, desc: string) => void;
  onFinishEdit: () => void;
}) {
  return (
    <>
      <input className="agent-config-item-input" value={item.name} autoFocus
        onChange={e => onUpdate(item.id, e.target.value, item.description || '')}
        onBlur={onFinishEdit} onKeyDown={e => e.key === 'Enter' && onFinishEdit()} />
      <input className="agent-config-item-input" value={item.description || ''}
        onChange={e => onUpdate(item.id, item.name, e.target.value)}
        onBlur={onFinishEdit} onKeyDown={e => e.key === 'Enter' && onFinishEdit()} />
    </>
  );
}
