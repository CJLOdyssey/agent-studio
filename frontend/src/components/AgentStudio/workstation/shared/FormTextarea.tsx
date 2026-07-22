import type { ChangeEvent } from 'react';

interface FormTextareaProps {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  error?: string;
  rows?: number;
}

export default function FormTextarea({ label, value, onChange, placeholder, maxLength, required, error, rows = 3 }: FormTextareaProps) {
  return (
    <div className="mb-4">
      <label className="text-xs font-medium text-da-text-muted">
        {label}{required && <span className="text-da-status-error ml-0.5">*</span>}
      </label>
      <textarea
        className={`flex min-h-[80px] w-full rounded-lg border bg-da-bg-primary px-3 py-2 text-sm text-da-text-primary outline-none resize-y mt-1 ${error ? 'border-da-status-error focus:ring-1 focus:ring-da-status-error/30' : 'border-da-border-subtle focus:border-da-accent focus:ring-1 focus:ring-da-accent/30'}`}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={rows}
      />
      <div className="flex justify-between mt-1">
        {error ? <p className="text-xs text-da-status-error">{error}</p> : <span />}
        {maxLength ? (
          <span className={`text-xs ${value.length > maxLength * 0.9 ? 'text-da-status-warning' : 'text-da-text-muted'}`}>
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
    </div>
  );
}
