import { X } from 'lucide-react';

interface Props {
  name: string;
  label?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function DeleteConfirmModal({ name, label = '项目', onConfirm, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wsta-modal wsta-modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>确认删除</h3>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <p className="wsta-confirm-text">
            确定要删除 {label} <strong>「{name}」</strong> 吗？此操作不可撤销。
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-danger" onClick={onConfirm}>确认删除</button>
        </div>
      </div>
    </div>
  );
}
