interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  label?: string;
}

export default function ToggleSwitch({ checked, onChange, size = 'md', label }: Props) {
  return (
    <label className={`toggle-switch ${size}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label || 'Toggle switch'}
      />
      <span className="toggle-slider"></span>
    </label>
  );
}
