import { useState, useMemo, useEffect } from 'react';
import { Search, X, ChevronLeft, ChevronRight, Info, AlertTriangle, AlertCircle, FileText } from 'lucide-react';
import { PAGE_SIZE } from '../constants';
import { TableSkeleton } from '../shared/LoadingSkeleton';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { MOCK_LOGS } from './mock-data';
import { fetchCommandLogs } from '../../../../api/client/admin';
import { t } from './locales';

type LogLevel = 'info' | 'warn' | 'error';
type LogModule = 'all' | 'agent' | 'prompt' | 'tool' | 'mcp' | 'skill' | 'team' | 'system';

interface LogEntry { id: string; timestamp: string; level: LogLevel; module: string; user: string; action: string; details: string; ip: string; }

const LOG_LEVELS: { value: LogLevel; label: string; icon: typeof Info; color: string }[] = [
  { value: 'info', label: 'INFO', icon: Info, color: '#3b82f6' },
  { value: 'warn', label: 'WARN', icon: AlertTriangle, color: '#f59e0b' },
  { value: 'error', label: 'ERROR', icon: AlertCircle, color: '#ef4444' },
];

const MODULES: LogModule[] = ['all', 'agent', 'prompt', 'tool', 'mcp', 'skill', 'team', 'system'];
const MODULE_LABEL: Record<LogModule, string> = { all: t('logs.all_modules'), agent: 'Agent', prompt: '提示词', tool: '工具', mcp: 'MCP', skill: 'Skills', team: '团队', system: '系统' };

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
        if (items.length > 0) {
          setLogs(items.map((item) => ({
            id: item.id,
            timestamp: item.timestamp.replace('T', ' ').substring(0, 19),
            level: 'info' as LogLevel,
            module: 'system',
            user: 'system',
            action: item.command,
            details: item.result || item.payload,
            ip: '',
          })));
        } else {
          setLogs(MOCK_LOGS);
        }
      })
      .catch(() => { if (!cancelled) setLogs(MOCK_LOGS); })
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

  const LevelIcon = ({ level }: { level: LogLevel }) => {
    const cfg = LOG_LEVELS.find((l) => l.value === level)!;
    return <cfg.icon size={14} style={{ color: cfg.color }} />;
  };

  return (
    <ErrorBoundary fallback={<div className="wsta-agent-mgmt wsta-error-state" role="alert"><p>{t('logs.error_render')}</p></div>}>
    <div className="wsta-agent-mgmt" role="region" aria-label={t('logs.empty')}>
      <div className="wsta-toolbar" role="toolbar" aria-label={t('logs.search_placeholder')}>
        <div className="wsta-toolbar-left">
          <div className="wsta-search-wrap">
            <Search size={14} className="wsta-search-icon" />
            <input className="wsta-search-input" placeholder={t('logs.search_placeholder')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('logs.search_placeholder')} />
            {search && <button className="wsta-search-clear" onClick={() => setSearch('')} aria-label={t('logs.search_placeholder')}><X size={14} /></button>}
          </div>
          <select className="wsta-filter-select" value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value as LogLevel | 'all'); setPage(1); }} aria-label={t('logs.col_level')}>
            <option value="all">{t('logs.all_levels')}</option>
            {LOG_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <select className="wsta-filter-select" value={moduleFilter} onChange={(e) => { setModuleFilter(e.target.value as LogModule); setPage(1); }} aria-label={t('logs.col_module')}>
            {MODULES.map((m) => <option key={m} value={m}>{MODULE_LABEL[m]}</option>)}
          </select>
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
                <td><code className="wsta-code">{entry.timestamp}</code></td>
                <td><span className="wsta-log-level"><LevelIcon level={entry.level} /> {entry.level.toUpperCase()}</span></td>
                <td><span className="wsta-tag wsta-tag-team">{MODULE_LABEL[entry.module as LogModule] || entry.module}</span></td>
                <td>{entry.user}</td><td>{entry.action}</td>
                <td className="wsta-log-details">{entry.details}</td><td><code className="wsta-code">{entry.ip}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="wsta-footer">
          <span className="wsta-footer-text">{t('logs.pagination', String(processed.length))}</span>
          <div className="wsta-pagination" role="navigation" aria-label={t('logs.pagination', String(processed.length))}>
            <button className="wsta-page-btn" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t('logs.page_prev')}><ChevronLeft size={14} /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={`wsta-page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)} aria-label={t('logs.page_num', String(p))} aria-current={p === page ? 'page' : undefined}>{p}</button>
            ))}
            <button className="wsta-page-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)} aria-label={t('logs.page_next')}><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

export default LogAudit;
