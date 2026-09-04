const PRICING_LINKS = [
  { label: 'OpenAI 官方定价', href: 'https://openai.com/api/pricing/' },
  { label: 'DeepSeek 官方定价', href: 'https://api-docs.deepseek.com/quick_start/pricing' },
  { label: 'Anthropic 官方定价', href: 'https://www.anthropic.com/pricing' },
];

/** 定价参考外链区块（纯展示，无数据依赖）。 */
export function PricingReference() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-overlay)] p-6 shadow-sm">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)]">模型定价参考</h3>
      <div className="mt-4 flex flex-wrap gap-4">
        {PRICING_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            {link.label} →
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--color-text-muted)]">
        注：实际计费以各平台官方最新定价为准，本地价格仅供参考。
      </p>
    </div>
  );
}
