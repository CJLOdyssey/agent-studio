import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/legacy/Sidebar';
import EmptyState from '../components/shared/EmptyState';
import ConfigPanel from '../components/shared/ConfigPanel';
import { useRuns } from '../api/hooks';

const PAGE_SIZE = 25;

export default function HistoryPage() {
  const navigate = useNavigate();
  const [showConfig, setShowConfig] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data: runs = [], isLoading, isFetching } = useRuns(limit);

  const statusLabel: Record<string, string> = {
    converged: '已完成',
    running: '进行中',
    error: '失败',
    pending: '等待中',
  };

  const statusClass: Record<string, string> = {
    converged: 'converged',
    running: 'running',
    error: 'error',
    pending: 'pending',
  };

  const hasMore = runs.length >= limit;

  const handleLoadMore = useCallback(() => {
    setLimit(prev => prev + PAGE_SIZE);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar onOpenSettings={() => setShowConfig(true)} />
      <main className="main-area main-area-scroll" id="main-content">
        <div className="history-page">
          <h2>历史记录</h2>
          {isLoading ? (
            <table className="history-table">
              <thead>
                <tr>
                  <th>需求</th>
                  <th>状态</th>
                  <th>时间</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`}>
                    <td><div className="skeleton skeleton-text" /></td>
                    <td><div className="skeleton skeleton-badge" /></td>
                    <td><div className="skeleton skeleton-date" /></td>
                    <td><div className="skeleton skeleton-btn" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : runs.length === 0 ? (
            <EmptyState icon={<span>📋</span>} title="暂无记录" description="开始一个新对话来创建讨论记录" />
          ) : (
            <>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>需求</th>
                    <th>状态</th>
                    <th>时间</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <td>{run.requirement.slice(0, 60)}</td>
                      <td>
                        <span className={`history-status ${statusClass[run.status] || 'pending'}`}>
                          {statusLabel[run.status] || run.status}
                        </span>
                      </td>
                      <td className="history-time-cell">
                        {run.created_at
                          ? new Date(run.created_at).toLocaleString('zh-CN')
                          : '-'}
                      </td>
                      <td>
                        <button
                          className="history-view-btn"
                          onClick={() => navigate(`/history/${run.id}`)}
                          aria-label={`查看 ${run.requirement.slice(0, 30)}`}
                        >
                          查看
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && (
                <div className="history-pagination">
                  <button
                    className="history-page-btn"
                    onClick={handleLoadMore}
                    disabled={isFetching}
                    aria-label="加载更多记录"
                  >
                    {isFetching ? '加载中...' : '加载更多'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {showConfig && <ConfigPanel onClose={() => setShowConfig(false)} />}
    </div>
  );
}
