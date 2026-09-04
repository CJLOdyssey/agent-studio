import Modal from '../../../../components/shared/Modal';
import { INPUT_CLASS } from './constants';

interface SilenceModalProps {
  name: string;
  hours: string;
  error: string;
  onClose: () => void;
  onHoursChange: (value: string) => void;
  onConfirm: () => void;
}

export function SilenceModal({ name, hours, error, onClose, onHoursChange, onConfirm }: SilenceModalProps) {
  return (
    <Modal
      title="静音规则"
      onClose={onClose}
      width={380}
      footer={
        <>
          <button className="px-4 py-1.5 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer" onClick={onClose}>取消</button>
          <button className="px-4 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium cursor-pointer hover:opacity-90" onClick={onConfirm}>确认</button>
        </>
      }
    >
      <div className="space-y-2">
        <p className="text-sm text-[var(--color-text-secondary)]">
          静音规则 <strong>「{name}」</strong>
        </p>
        <div>
          <label className="mb-1 block text-xs text-[var(--color-text-muted)]">静音时长(小时)</label>
          <input
            type="number"
            min="0.1"
            step="any"
            className={INPUT_CLASS}
            value={hours}
            onChange={(e) => onHoursChange(e.target.value)}
          />
          {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}
