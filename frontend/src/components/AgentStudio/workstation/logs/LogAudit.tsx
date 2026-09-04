import { useState, useEffect } from 'react';
import { Input, Select, Modal } from 'antd';
import { Search, FileText, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { PAGE_SIZE } from '../constants';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { fetchCommandLogs, type LogEntry } from '../../../../api/client/admin';
import { t } from './locales';
import WstaPagination from '../shared/WstaPagination';

type LogLevel = 'info' | 'warn' | 'error';
type LogModule = 'all' | 'agent' | 'prompt' | 'tool' | 'mcp' | 'skill' | 'team' | 'system' | 'command' | 'api_key';

interface Row extends LogEntry {
  module: string;
}

const LOG_LEVELS: { value: LogLevel; label: string; icon: typeof Info }[] = [
  { value: 'info', label: 'INFO', icon: Info },
  { value: 'warn', label: 'WARN', icon: AlertTriangle },
  { value: 'error', label: 'ERROR', icon: AlertCircle },
];

const MODULES: LogModule[] = ['all', 'agent', 'prompt', 'tool', 'mcp', 'skill', 'team', 'system', 'command', 'api_key'];
const MODULE_LABEL: Record<string, string> = { all: t('logs.all_modules'), agent: t('logs.module_agent'), prompt: t('logs.module_prompt'), tool: t('logs.module_tool'), mcp: t('logs.module_mcp'), skill: t('logs.module_skill'), team: t('logs.module_team'), system: t('logs.module_system'), command: '命令', api_key: 'API Key' };
const LEVEL_CLASS: Record<string, string> = { info: 'wsta-tag-indigo', warn: 'wsta-tag-amber', error: 'wsta-tag-red' };

function LogAudit() {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [moduleFilter, setModuleFilter] = useState<LogModule>('all');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [detailLog, setDetailLog] = useState<Row | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchCommandLogs({
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          search: search || undefined,
          level: levelFilter === 'all' ? undefined : levelFilter,
          entity_type: moduleFilter === 'all' ? undefined : moduleFilter,
        });
        if (cancelled) return;
        setLogs(data.items.map((item) => ({ ...item, module: item.entity_type })));
        setTotal(data.total);
      } catch {
        if (cancelled) return;
        setLogs([]);
        setTotal(0);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, search, levelFilter, moduleFilter]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setIsLoading(true);
  };

  const handleLevel = (value: LogLevel | 'all') => {
    setLevelFilter(value);
    setPage(1);
    setIsLoading(true);
  };

  const handleModule = (value: LogModule) => {
    setModuleFilter(value);
    setPage(1);
    setIsLoading(true);
  };

  const handlePage = (p: number) => {
    setPage(p);
    setIsLoading(true);
  };

  const formatTime = (ts: string) => (ts ? ts.replace('T', ' ').substring(0, 19) : '-');

  return (
    <ErrorBoundary fallback={<div className="flex flex-col h-full flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center" role="alert"><p>{t('logs.error_render')}</p></div>}>
    <div className="flex flex-col h-full" role="region" aria-label={t('logs.empty')}>
      <div className="flex items-center justify-between gap-3 py-4 px-6 shrink-0" role="toolbar" aria-label={t('logs.search_placeholder')}>
        <div className="flex items-center gap-3 flex-1">
          <Input
            prefix={<Search size={14} />}
            allowClear
            style={{ maxWidth: 320 }}
            placeholder={t('logs.search_placeholder')}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <Select style={{ width: 120 }} value={levelFilter} onChange={(v) => handleLevel(v as LogLevel | 'all')} options={[
            { value: 'all', label: t('logs.all_levels') },
            ...LOG_LEVELS.map((l) => ({ value: l.value, label: l.label })),
          ]} />
          <Select style={{ width: 130 }} value={moduleFilter} onChange={(v) => handleModule(v as LogModule)} options={MODULES.map((m) => ({ value: m, label: MODULE_LABEL[m] }))} />
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
        {isLoading ? <TableSkeleton rows={8} cols={7} /> : logs.length === 0 ? (
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
            {logs.map((entry) => (
              <tr key={entry.id} onClick={() => setDetailLog(entry)} className="cursor-pointer">
                <td><span className="font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">{formatTime(entry.timestamp)}</span></td>
                <td><span className={`wsta-tag-pill ${LEVEL_CLASS[entry.level] || 'wsta-tag-indigo'}`}>{entry.level.toUpperCase()}</span></td>
                <td><span className="inline-block py-0.5 px-2.5 rounded-md text-xs font-medium bg-[var(--color-accent)]/8 text-[var(--color-accent)] whitespace-nowrap">{MODULE_LABEL[entry.module] || entry.module}</span></td>
                <td className="whitespace-nowrap">{entry.user || '-'}</td>
                <td className="whitespace-nowrap">{entry.action}</td>
                <td className="text-sm text-[var(--color-text-secondary)] truncate max-w-[280px]" title={entry.detail}>{entry.detail || '-'}</td>
                <td><span className="font-mono text-xs text-[var(--color-text-muted)] whitespace-nowrap">{entry.ip || '-'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      <WstaPagination
        current={page}
        total={total}
        pageSize={PAGE_SIZE}
        onChange={handlePage}
      />

      <Modal
        open={detailLog !== null}
        title="审计日志详情"
        footer={null}
        width={620}
        centered
        onCancel={() => setDetailLog(null)}
      >
        {detailLog && (
          <div className="flex flex-col gap-3 py-2 text-sm">
            <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">时间</span><span className="font-mono text-[var(--color-text-primary)]">{formatTime(detailLog.timestamp)}</span></div>
            <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">级别</span><span className={`wsta-tag-pill ${LEVEL_CLASS[detailLog.level] || 'wsta-tag-indigo'}`}>{detailLog.level.toUpperCase()}</span></div>
            <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">模块</span><span>{MODULE_LABEL[detailLog.module] || detailLog.module}</span></div>
            <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">用户</span><span>{detailLog.user || '-'}</span></div>
            <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">操作</span><span>{detailLog.action}</span></div>
            <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">IP 地址</span><span className="font-mono">{detailLog.ip || '-'}</span></div>
            <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">User-Agent</span><span className="font-mono text-xs break-all">{detailLog.user_agent || '-'}</span></div>
            <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">Request ID</span><span className="font-mono text-xs break-all">{detailLog.request_id || '-'}</span></div>
            <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">详情</span><div className="text-[var(--color-text-primary)] whitespace-pre-wrap break-words leading-relaxed">{detailLog.detail || '-'}</div></div>
            {detailLog.before && (
              <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">变更前</span><pre className="flex-1 m-0 p-2 rounded bg-[var(--color-bg-secondary)] font-mono text-xs whitespace-pre-wrap break-words leading-relaxed">{detailLog.before}</pre></div>
            )}
            {detailLog.after && (
              <div className="flex gap-2"><span className="w-20 shrink-0 text-[var(--color-text-muted)]">变更后</span><pre className="flex-1 m-0 p-2 rounded bg-[var(--color-bg-secondary)] font-mono text-xs whitespace-pre-wrap break-words leading-relaxed">{detailLog.after}</pre></div>
            )}
          </div>
        )}
      </Modal>
    </div>
    </ErrorBoundary>
  );
}

export default LogAudit;
