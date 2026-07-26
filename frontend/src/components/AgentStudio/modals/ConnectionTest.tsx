import { Loader2 } from 'lucide-react';

export interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
}

interface Props {
  onTest: () => void;
  disabled: boolean;
  testing: boolean;
  testResult: TestResult | null;
}

export default function ConnectionTest({ onTest, disabled, testing, testResult }: Props) {
  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onTest}
        disabled={disabled || testing}
      >
        {testing ? <Loader2 size={14} className="animate-spin" /> : null}
        {testing ? '测试中...' : '测试连接'}
      </button>

      {testResult && (
        <div className={`mt-3 px-3 py-2 rounded-md text-sm border ${
          testResult.success
            ? 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] border-[color-mix(in_srgb,var(--color-success)_25%,transparent)] text-[var(--color-success)]'
            : 'bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border-[color-mix(in_srgb,var(--color-danger)_25%,transparent)] text-[var(--color-danger)]'
        }`}>
          {testResult.success ? '✅ 连接成功' : '❌ ' + testResult.message}
          {testResult.latency ? <span className="ml-2 opacity-70">{testResult.latency}ms</span> : null}
        </div>
      )}
    </div>
  );
}
