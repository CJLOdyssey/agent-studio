import { useState, useMemo, useEffect } from 'react';
import { Input, Select, Modal } from 'antd';
import { Search, FileText, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { PAGE_SIZE } from '../constants';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { fetchCommandLogs } from '../../../../api/client/admin';
import { t } from './locales';
import WstaPagination from '../shared/WstaPagination';

type LogLevel = 'info' | 'warn' | 'error';
type LogModule = 'all' | 'agent' | 'prompt' | 'tool' | 'mcp' | 'skill' | 'team' | 'system' | 'command' | 'api_key';

interface LogEntry { id: string; timestamp: string; level: LogLevel; module: string; user: string; action: string; details: string; ip: string; }

const LOG_LEVELS: { value: LogLevel; label: string; icon: typeof Info }[] = [
  { value: 'info', label: 'INFO', icon: Info },
  { value: 'warn', label: 'WARN', icon: AlertTriangle },
  { value: 'error', label: 'ERROR', icon: AlertCircle },
];

// 审计级别由操作类型推导（delete 告警级，其余 info）——不再硬编码。
function deriveLevel(action: string): LogLevel {
  const a = (action || '').toLowerCase();
  if (a.includes('delete') || a.includes('删除')) return 'warn';
  return 'info';
}

const MODULES: LogModule[] = ['all', 'agent', 'prompt', 'tool', 'mcp', 'skill', 'team', 'system', 'command', 'api_key'];
const MODULE_LABEL: Record<string, string> = { all: t('logs.all_modules'), agent: t('logs.module_agent'), prompt: t('logs.module_prompt'), tool: t('logs.module_tool'), mcp: t('logs.module_mcp'), skill: t('logs.module_skill'), team: t('logs.module_team'), system: t('logs.module_system'), command: '命令', api_key: 'API Key' };
const LEVEL_CLASS: Record<string, string> = { info: 'wsta-tag-indigo', warn: 'wsta-tag-amber', error: 'wsta-tag-red' };

function LogAudit() {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [moduleFilter, setModuleFilter] = useState<LogModule>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [detailLog, setDetailLog] = useState<LogEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCommandLogs(200, 0)
      .then((data) => {
        if (cancelled) return;
        setLogs(data.items.length > 0
          ? data.items.map((item) => ({
              id: item.id,
              timestamp: item.timestamp.replace('T', ' ').substring(0, 19),
              level: deriveLevel(item.action),
              module: item.entity_type,
              user: item.user || '-',
              action: item.action,
              details: item.entity_name
                ? (item.detail ? `${item.entity_name} — ${item.detail}` : item.entity_name)
                : (item.detail || item.action),
              ip: item.ip || '-',
            }))
          : []);
      })
      .catch(() => { if (!cancelled) setLogs([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const processed = useMemo(() => {
    let arr = [...logs];
    const q = search.toLowerCase();
    if (q) arr = arr.filter((l) => l.action.toLowerCase().includes(q) || l.details.toLowerCase().includes(q) || l.user.toLowerCase().includes(q) || l.module.includes(q));
    if (levelFilter !== 'all') arr = arr.filter((l) => l.level === levelFilter);
    if (moduleFilter !== 'all') arr = arr.filter((l) => l.module === moduleFilter);
    return arr;
  }, [search, levelFilter, moduleFilter, logs]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = processed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('logs.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label={t('logs.empty')}>
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar" aria-label={t('logs.search_placeholder')}>
        <div className="flex items-center gap-3 flex-1">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('logs.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select style={{ width: 120 }} value={levelFilter} onChange={(v) => { setLevelFilter(v as LogLevel | 'all'); setPage(1); }} options={[
            { value: 'all', label: t('logs.all_levels') },
            ...LOG_LEVELS.map((l) => ({ value: l.value, label: l.label })),
          ]} />
          <Select style={{ width: 130 }} value={moduleFilter} onChange={(v) => { setModuleFilter(v as LogModule); setPage(1); }} options={MODULES.map((m) => ({ value: m, label: MODULE_LABEL[m] }))} />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {isLoading ? <TableSkeleton rows={8} cols={7} /> : processed.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center">
            <FileText size={40} className="text-[var(--color-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--color-text-secondary)]">{t('logs.empty')}</div>
          </div>
        ) : (
        <table className="w-full table-fixed border-collapse text-sm" role="grid" aria-label={t('logs.empty')}>
          <thead>
            <tr>
              <th scope="col">{t('logs.col_time')}</th>
              <th scope="col">{t('logs.col_level')}</th>
              <th scope="col">{t('logs.col_module')}</th>
              <th scope="col">{t('logs.col_user')}</th>
              <th scope="col">{t('logs.col_action')}</th>
              <th scope="col">{t('logs.col_details')}</th>
              <th scope="col">{t('logs.col_ip')}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((entry) => (
              <tr key={entry.id} onClick={() => setDetailLog(entry)} className="cursor-pointer">
                <td><span className="font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">{entry.timestamp}</span></td>
                <td><span className={`wsta-tag-pill ${LEVEL_CLASS[entry.level] || 'wsta-tag-indigo'}`}>{entry.level.toUpperCase()}</span></td>
                <td><span className="inline-block py-0.5 px-2.5 rounded-md text-xs font-medium bg-[var(--color-accent)]/8 text-[var(--color-accent)] whitespace-nowrap">{MODULE_LABEL[entry.module] || entry.module}</span></td>
                <td className="whitespace-nowrap">{entry.user}</td>
                <td className="whitespace-nowrap">{entry.action}</td>
                <td className="text-sm text-[var(--color-text-secondary)] truncate max-w-[280px]" title={entry.details}>{entry.details}</td>
                <td><span className="font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">{entry.ip}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      <WstaPagination
        current={page}
        total={processed.length}
        pageSize={PAGE_SIZE}
        onChange={(p) => setPage(p)}
      />

      <Modal
        open={detailLog !== null}
        title="审计日志详情"
        footer={null}
        width={560}
        centered
        onCancel={() => setDetailLog(null)}
      >
        {detailLog && (
          <div className="flex flex-col gap-3 py-2 text-sm">
            <div className="flex gap-2"><span className="w-16 shrink-0 text-[var(--color-text-muted)]">时间</span><span className="font-mono text-[var(--color-text-primary)]">{detailLog.timestamp}</span></div>
            <div className="flex gap-2"><span className="w-16 shrink-0 text-[var(--color-text-muted)]">级别</span><span className={`wsta-tag-pill ${LEVEL_CLASS[detailLog.level] || 'wsta-tag-indigo'}`}>{detailLog.level.toUpperCase()}</span></div>
            <div className="flex gap-2"><span className="w-16 shrink-0 text-[var(--color-text-muted)]">模块</span><span>{MODULE_LABEL[detailLog.module] || detailLog.module}</span></div>
            <div className="flex gap-2"><span className="w-16 shrink-0 text-[var(--color-text-muted)]">用户</span><span>{detailLog.user}</span></div>
            <div className="flex gap-2"><span className="w-16 shrink-0 text-[var(--color-text-muted)]">操作</span><span>{detailLog.action}</span></div>
            <div className="flex gap-2"><span className="w-16 shrink-0 text-[var(--color-text-muted)]">IP 地址</span><span className="font-mono">{detailLog.ip}</span></div>
            <div className="flex gap-2"><span className="w-16 shrink-0 text-[var(--color-text-muted)]">详情</span><div className="text-[var(--color-text-primary)] whitespace-pre-wrap break-words leading-relaxed">{detailLog.details}</div></div>
          </div>
        )}
      </Modal>
    </div>
    </ErrorBoundary>
  );
}

export default LogAudit;
