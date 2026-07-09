import type { ChangeEvent } from 'react';

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  error?: string;
}

export default function FormField({ label, value, onChange, placeholder, maxLength, required, error }: FormFieldProps) {
  return (
    <div className="mb-4">
      <label className="text-xs font-medium text-da-text-muted">
        {label}{required && <span className="text-da-status-error ml-0.5">*</span>}
      </label>
      <input
        className={`flex h-10 w-full rounded-lg border bg-da-bg-primary px-3 py-2 text-sm text-da-text-primary outline-none mt-1 ${error ? 'border-da-status-error focus:ring-1 focus:ring-da-status-error/30' : 'border-da-border-subtle focus:border-da-accent focus:ring-1 focus:ring-da-accent/30'}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {error && <p className="mt-1 text-xs text-da-status-error">{error}</p>}
    </div>
  );
}
