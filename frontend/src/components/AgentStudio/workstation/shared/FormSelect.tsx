import type { ChangeEvent } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface FormSelectProps {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export default function FormSelect({ label, value, onChange, options, placeholder, required, error }: FormSelectProps) {
  return (
    <div className="mb-4">
      <label className="text-xs font-medium text-da-text-muted">
        {label}{required && <span className="text-da-status-error ml-0.5">*</span>}
      </label>
      <select
        className={`flex h-10 w-full rounded-lg border bg-da-bg-primary px-3 py-2 text-sm text-da-text-primary outline-none cursor-pointer appearance-none mt-1 ${error ? 'border-da-status-error focus:ring-1 focus:ring-da-status-error/30' : 'border-da-border-subtle focus:border-da-accent focus:ring-1 focus:ring-da-accent/30'}`}
        value={value}
        onChange={onChange}
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      {error && <p className="mt-1 text-xs text-da-status-error">{error}</p>}
    </div>
  );
}
