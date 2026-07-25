import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';

export function CopyBtn({ text, label, className }: { text: string; label?: string; className?: string }) {
  const { copy, isCopied } = useCopyToClipboard();
  const { t } = useTranslation();
  const key = text.slice(0, 32);
  const copied = isCopied(key);
  return (
    <button
      className={`${className || 'px-1 py-0.5 bg-transparent border-none rounded text-[var(--da-text-muted)] cursor-pointer flex items-center transition-colors duration-150 hover:text-[var(--da-text-primary)] hover:bg-[var(--da-bg-hover)]'}${copied ? ' !text-[var(--da-accent-emerald)] hover:!text-[var(--da-accent-emerald)] hover:!bg-[var(--da-bg-hover)]' : ''}`}
      onClick={() => copy(text, key)}
      title={copied ? t('teamMessage.copied') : label}
      aria-label={copied ? t('teamMessage.copied') : label}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}
