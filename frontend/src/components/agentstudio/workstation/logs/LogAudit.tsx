import { useState, useMemo, useEffect } from 'react';
import { Input, Select } from 'antd';
import { Search, FileText, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { PAGE_SIZE } from '../constants';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { fetchCommandLogs } from '../../../../api/client/admin';
import { t } from './locales';
import WstaPagination from '../shared/WstaPagination';

type LogLevel = 'info' | 'warn' | 'error';
type LogModule = 'all' | 'agent' | 'prompt' | 'tool' | 'mcp' | 'skill' | 'team' | 'system';

interface LogEntry { id: string; timestamp: string; level: LogLevel; module: string; user: string; action: string; details: string; ip: string; }

const LOG_LEVELS: { value: LogLevel; label: string; icon: typeof Info }[] = [
  { value: 'info', label: 'INFO', icon: Info },
  { value: 'warn', label: 'WARN', icon: AlertTriangle },
  { value: 'error', label: 'ERROR', icon: AlertCircle },
];

const MODULES: LogModule[] = ['all', 'agent', 'prompt', 'tool', 'mcp', 'skill', 'team', 'system'];
const MODULE_LABEL: Record<string, string> = { all: t('logs.all_modules'), agent: t('logs.module_agent'), prompt: t('logs.module_prompt'), tool: t('logs.module_tool'), mcp: t('logs.module_mcp'), skill: t('logs.module_skill'), team: t('logs.module_team'), system: t('logs.module_system') };
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
      .then((items) => {
        if (cancelled) return;
        setLogs(items.length > 0
          ? items.map((item) => ({
              id: item.id,
              timestamp: item.timestamp.replace('T', ' ').substring(0, 19),
              level: 'info' as LogLevel,
              module: 'system',
              user: 'system',
              action: item.command,
              details: item.result || item.payload,
              ip: '',
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
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('logs.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('logs.empty')}>
      <div className="wsta-toolbar" role="toolbar" aria-label={t('logs.search_placeholder')}>
        <div className="wsta-toolbar-left">
          <Input prefix={<Search size={14} />} allowClear style={{ maxWidth: 320 }} placeholder={t('logs.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select style={{ width: 120 }} value={levelFilter} onChange={(v) => { setLevelFilter(v as LogLevel | 'all'); setPage(1); }} options={[
            { value: 'all', label: t('logs.all_levels') },
            ...LOG_LEVELS.map((l) => ({ value: l.value, label: l.label })),
          ]} />
          <Select style={{ width: 130 }} value={moduleFilter} onChange={(v) => { setModuleFilter(v as LogModule); setPage(1); }} options={MODULES.map((m) => ({ value: m, label: MODULE_LABEL[m] }))} />
        </div>
      </div>

      <div className="wsta-table-wrap">
        {isLoading ? <TableSkeleton rows={8} cols={7} /> : processed.length === 0 ? (
          <div className="wsta-empty-state">
            <FileText size={40} className="wsta-empty-state-icon" />
            <div className="wsta-empty-state-title">{t('logs.empty')}</div>
          </div>
        ) : (
        <table className="wsta-table" role="grid" aria-label={t('logs.empty')}>
          <thead><tr>
            <th scope="col">{t('logs.col_time')}</th><th scope="col">{t('logs.col_level')}</th><th scope="col">{t('logs.col_module')}</th>
            <th scope="col">{t('logs.col_user')}</th><th scope="col">{t('logs.col_action')}</th><th scope="col">{t('logs.col_details')}</th><th scope="col">{t('logs.col_ip')}</th>
          </tr></thead>
          <tbody>
            {paged.map((entry: LogEntry) => (
              <tr key={entry.id}>
                <td><span className="wsta-mono-text">{entry.timestamp}</span></td>
                <td><span className={`wsta-tag-pill ${LEVEL_CLASS[entry.level] || 'wsta-tag-indigo'}`}>{entry.level.toUpperCase()}</span></td>
                <td><span className="wsta-tag-pill wsta-tag-indigo">{MODULE_LABEL[entry.module] || entry.module}</span></td>
                <td>{entry.user}</td><td>{entry.action}</td>
                <td className="wsta-secondary-text">{entry.details}</td><td><span className="wsta-mono-text">{entry.ip}</span></td>
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
    </div>
    </ErrorBoundary>
  );
}

export default LogAudit;
