import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TraceSpan } from '../../../../../api/client/traces';
import { formatRelativeTime, formatTokens } from '../shared/format';

export function ms(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

/** 把 ISO 时间转成本地时区的精确字符串；后端存的是 UTC，不能裸 slice 显示（会差 8h）。 */
function fmtLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { hour12: false });
}

/** 相对时间显示，绝对时间做 title（大厂 trace 页默认 relative-time） */
export function RelTime({ iso }: { iso: string | null }) {
  let rel: string | null = null;
  let abs: string | null = null;
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      rel = formatRelativeTime(d);
      abs = d.toLocaleString('zh-CN', { hour12: false });
    }
  }
  if (rel === null || !abs) return <span className="text-[var(--color-text-muted)]">—</span>;
  return (
    <time dateTime={iso ?? undefined} title={abs} className="tabular-nums">
      {rel}
    </time>
  );
}

/** 状态徽章：全圆角浅底 badge（非裸色点） */
export function StatusBadge({ status }: { status: TraceSpan['status'] }) {
  const map: Record<TraceSpan['status'], { label: string; cls: string }> = {
    success: {
      label: '成功',
      cls: 'bg-[color-mix(in_srgb,var(--color-success)_12%,transparent)] text-[var(--color-success)]',
    },
    error: {
      label: '失败',
      cls: 'bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]',
    },
    running: {
      label: '运行中',
      cls: 'bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]',
    },
  };
  const s = map[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function PayloadBlock({ title, text, accent }: { title: string; text: string; accent: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-hover)]/50">
      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
        {title} · {text.length} 字符
      </div>
      <pre className="px-3 pb-2 text-[11px] leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto font-mono text-[var(--color-text-secondary)]">
        {text}
      </pre>
    </div>
  );
}

export function SpanRow({
  span,
  depth,
  displayName,
}: {
  span: TraceSpan;
  depth: number;
  /** 覆盖机器 node_id 的展示名（根 agent span 用 run 的用户需求标题，避免每条都显示死占位 "chat"）。 */
  displayName?: string;
}) {
  const [open, setOpen] = useState(false);
  const isTool = span.spanType === 'tool';
  const kindLabel =
    span.spanType === 'llm'
      ? 'LLM'
      : span.spanType === 'tool'
        ? '工具'
        : span.spanType === 'chat'
          ? '对话'
          : span.spanType === 'agent'
            ? 'Agent'
            : '节点';
  const badgeBg =
    span.spanType === 'llm'
      ? 'bg-[color-mix(in_srgb,var(--color-accent)_14%,transparent)] text-[var(--color-accent)]'
      : span.spanType === 'tool'
        ? 'bg-[color-mix(in_srgb,var(--color-warning)_14%,transparent)] text-[var(--color-warning)]'
        : span.spanType === 'chat'
          ? 'bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent-hover)]'
          : 'bg-[color-mix(in_srgb,var(--color-text-secondary)_12%,transparent)] text-[var(--color-text-secondary)]';
  const hasChildren = !isTool && span.spanType !== 'llm';
  const name = displayName || (isTool ? span.nodeId.split('.').pop() || span.nodeId : span.nodeId);
  const hasPayload = !!(span.inputSnapshot || span.outputSnapshot || span.error);
  const isErr = span.status === 'error';

  return (
    <div className={`border-b border-[var(--color-border)]/50 last:border-0 ${isErr ? 'bg-[color-mix(in_srgb,var(--color-danger)_3%,transparent)]' : ''}`}>
      {/* 主行：层级用左边距表达，箭头 / 徽章 / 名对齐在中左，指标右聚固定列 */}
      <div
        className={`flex items-center gap-2 py-2 pr-4 transition-colors hover:bg-[var(--color-surface-hover)] ${
          isErr ? 'border-l-2 border-[var(--color-danger)]' : 'border-l-2 border-transparent hover:border-[var(--color-accent)]'
        }`}
        style={{ paddingLeft: 8 + depth * 18 }}
        onClick={() => {
          if (hasChildren || hasPayload) setOpen((v) => !v);
        }}
      >
        {/* 展开箭头固定 20px，保证所有层级箭头垂直对齐 */}
        <span className="w-5 shrink-0 text-center text-xs text-[var(--color-text-muted)]">
          {hasChildren || hasPayload ? (
            open ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <ChevronRight size={14} className="opacity-20" />
          )}
        </span>

        <span className={`shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold ${badgeBg}`}>
          {kindLabel}
        </span>

        {/* 名字 + 紧跟其后的节点/model 副标签（填满中间，不再挤右下角） */}
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-xs font-medium text-[var(--color-text-primary)]" title={name}>
            {name}
          </span>
          {span.model && (
            <span className="hidden truncate rounded-full border border-[var(--color-border)] bg-[var(--color-surface-overlay)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-secondary)] md:inline-block max-w-[220px]" title={span.model}>
              {span.model}
            </span>
          )}
          {span.nodeId && !displayName && (
            <span className="hidden truncate text-[10px] text-[var(--color-text-muted)] sm:inline-block max-w-[140px]" title={span.nodeId}>
              节点 {span.nodeId}
            </span>
          )}
        </span>

        {/* 右侧固定指标列：token · 耗时 · 状态（短定宽，消除松散） */}
        <span className="flex shrink-0 items-center gap-3 pl-3">
          <span className="hidden text-[11px] text-[var(--color-text-secondary)] tabular-nums sm:inline">
            {span.totalTokens > 0 ? `${formatTokens(span.totalTokens)} tok` : '—'}
          </span>
          <span className="w-12 text-right text-xs font-medium text-[var(--color-text-primary)] tabular-nums">
            {ms(span.durationMs)}
          </span>
          <StatusBadge status={span.status} />
        </span>
      </div>

      {/* 展开明细：作为主行明显右缩的子块（比子 span 再深一层） */}
      {open && (
        <div
          className="mb-2 mr-3 overflow-hidden rounded-md border border-[var(--color-border)]/70 bg-[var(--color-surface-hover)]/40"
          style={{ marginLeft: 8 + depth * 18 + 40 }}
        >
          {/* 展开不重复主行的类型徽章/名字，只补主行没有的精确开始时间 */}
          {span.createdAt && (
            <div className="border-b border-[var(--color-border)]/50 px-3 py-1.5 text-[10px] tabular-nums text-[var(--color-text-muted)]">
              开始于 {fmtLocal(span.createdAt)}
            </div>
          )}

          {/* Token 明细：label:value 分行，一眼读清 */}
          <div className="grid grid-cols-3 gap-2 border-b border-[var(--color-border)]/50 px-3 py-2 text-[11px]">
            <div className="min-w-0">
              <div className="text-[10px] text-[var(--color-text-muted)]">输入 tokens</div>
              <div className="mt-0.5 tabular-nums font-medium text-[var(--color-text-primary)]">
                {formatTokens(span.promptTokens)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-[var(--color-text-muted)]">输出 tokens</div>
              <div className="mt-0.5 tabular-nums font-medium text-[var(--color-text-primary)]">
                {formatTokens(span.completionTokens)}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-[var(--color-text-muted)]">合计</div>
              <div className="mt-0.5 tabular-nums font-medium text-[var(--color-text-primary)]">
                {formatTokens(span.totalTokens)}
              </div>
            </div>
          </div>

          {/* 错误折叠 */}
          {span.error && (
            <div className="m-3 mb-0 overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--color-danger)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_6%,transparent)]">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-[var(--color-danger)]">错误信息</div>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words px-3 pb-2 font-mono text-[11px] leading-relaxed text-[var(--color-danger)]">
                {span.error}
              </pre>
            </div>
          )}

          {span.inputSnapshot && <div className="px-3 pt-3"><PayloadBlock title="输入" text={span.inputSnapshot} accent="var(--color-accent)" /></div>}
          {span.outputSnapshot && <div className="px-3 pt-3"><PayloadBlock title="输出" text={span.outputSnapshot} accent="var(--color-success)" /></div>}
          {!span.inputSnapshot && !span.outputSnapshot && !span.error && (
            <div className="px-3 py-3 text-center text-[11px] text-[var(--color-text-muted)]">
              该 span 未记录输入/输出原文（聚合型根节点）
            </div>
          )}
        </div>
      )}
    </div>
  );
}
