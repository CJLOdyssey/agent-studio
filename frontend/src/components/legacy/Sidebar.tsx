import { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { listSessions, getSessionDetail, getRun } from '../../api/client';
import type { SessionItem, AppStatus } from '../../types';

interface Props {
  onOpenSettings: () => void;
}

export default function Sidebar({ onOpenSettings }: Props) {
  const { restoreSession } = useChatStore();
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await listSessions(1);
        setSessions(data);
      } catch { setSessions([]); }
    })();
  }, []);

  const selectSession = async (sessionId: string) => {
    try {
      const detail = await getSessionDetail(sessionId);
      if (!detail.runs?.length) return;
      const run = detail.runs[0];
      const detail2 = await getRun(run.id);
      const isFinished = detail2.status === 'converged' || detail2.status === 'completed';
      const appStatus: AppStatus = isFinished ? 'completed' : 'idle';
      restoreSession(
        sessionId, run.id,
        detail2.messages || [],
        isFinished ? {
          requirement: detail2.requirement,
          pm_document: detail2.pm_document,
          code: detail2.code,
          review: detail2.review,
          approved: detail2.approved,
          status: detail2.status,
        } : null,
        appStatus,
      );
    } catch { /* silent */ }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span>🏢</span>
          <span>虚拟软件外包团队</span>
        </div>
        <div className="sidebar-logo-sub">AI Agent 协同工作台</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">对话历史</div>
      </div>
      <div className="sidebar-history">
        {sessions.map(sess => (
          <div key={sess.id} className="history-item" onClick={() => selectSession(sess.id)}>
            <div className="history-item-text">
              {sess.title?.length > 22 ? sess.title.slice(0, 22) + '...' : sess.title || '无标题'}
            </div>
            <div className="history-item-time">
              {sess.created_at ? new Date(sess.created_at).toLocaleString('zh-CN') : ''}
            </div>
          </div>
        ))}
        {sessions.length === 0 && (
          <div className="sidebar-empty-hint">暂无对话记录</div>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="settings-btn" onClick={onOpenSettings}>
          ⚙️ 配置
        </button>
      </div>
    </aside>
  );
}
