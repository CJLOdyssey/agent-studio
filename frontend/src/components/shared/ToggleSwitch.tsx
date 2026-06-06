interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
}

export default function ToggleSwitch({ checked, onChange, size = 'md' }: Props) {
  return (
    <label className={`toggle-switch ${size}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-slider"></span>
    </label>
  );
}
