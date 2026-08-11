import { useState, useMemo, useEffect, forwardRef } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { Input, Select } from 'antd';
import { Search, FileText, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { PAGE_SIZE } from '../constants';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { fetchCommandLogs } from '../../../../api/client/admin';
import { t } from './locales';
import WstaPagination from '../shared/WstaPagination';
import type * as React from 'react';

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

      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto overflow-x-hidden" style={processed.length > 0 && !isLoading ? { overflow: 'hidden' } : undefined}>
        {isLoading ? <TableSkeleton rows={8} cols={7} /> : processed.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 px-4 text-center">
            <FileText size={40} className="text-[var(--color-text-muted)] opacity-50" />
            <div className="text-lg font-semibold text-[var(--color-text-secondary)]">{t('logs.empty')}</div>
          </div>
        ) : (
        <TableVirtuoso
          style={{ height: '400px' }}
          data={paged}
          components={{
            Table: forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>((props, ref) => (
              <table ref={ref} className="w-full table-fixed border-collapse text-sm" role="grid" aria-label={t('logs.empty')} {...props} />
            )),
          }}
          fixedHeaderContent={() => (
            <tr>
              <th scope="col">{t('logs.col_time')}</th>
              <th scope="col">{t('logs.col_level')}</th>
              <th scope="col">{t('logs.col_module')}</th>
              <th scope="col">{t('logs.col_user')}</th>
              <th scope="col">{t('logs.col_action')}</th>
              <th scope="col">{t('logs.col_details')}</th>
              <th scope="col">{t('logs.col_ip')}</th>
            </tr>
          )}
          itemContent={(_index: number, entry: LogEntry) => (
            <>
              <td><span className="font-mono text-xs text-[var(--color-text-muted)]">{entry.timestamp}</span></td>
              <td><span className={`wsta-tag-pill ${LEVEL_CLASS[entry.level] || 'wsta-tag-indigo'}`}>{entry.level.toUpperCase()}</span></td>
              <td><span className="inline-block py-0.5 px-2.5 rounded-md text-xs font-medium bg-[var(--color-accent)]/8 text-[var(--color-accent)]">{MODULE_LABEL[entry.module] || entry.module}</span></td>
              <td>{entry.user}</td>
              <td>{entry.action}</td>
              <td className="text-sm text-[var(--color-text-secondary)]">{entry.details}</td>
              <td><span className="font-mono text-xs text-[var(--color-text-muted)]">{entry.ip}</span></td>
            </>
          )}
        />
        )}
      </div>

      <WstaPagination
        current={page}
        total={processed.length}
        pageSize={PAGE_SIZE}
        onChange={(p) => setPage(p)}
      />
    </div>
    </ErrorBoundary>
  );
}

export default LogAudit;
