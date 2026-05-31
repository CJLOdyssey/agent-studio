import { useState, useEffect } from 'react';
import Sidebar from '../components/legacy/Sidebar';
import ChatMessages from '../components/legacy/ChatMessages';
import ChatInput from '../components/legacy/ChatInput';
import ConfigPanel from '../components/shared/ConfigPanel';
import { useChatStore } from '../stores/chatStore';
import { listSessions, getSessionDetail, getRun } from '../api/client';
import type { AppStatus } from '../types';

export default function HomePage() {
  const {
    messages,
    status,
    result,
    error,
    currentRole,
    submitRequirement,
    restoreSession,
  } = useChatStore();

  const [showConfig, setShowConfig] = useState(false);
  const loading = status === 'loading' || status === 'running';

  useEffect(() => {
    (async () => {
      try {
        const sessions = await listSessions(1);
        if (sessions.length === 0) return;
        const sDetail = await getSessionDetail(sessions[0].id);
        if (!sDetail.runs?.length) return;
        const run = sDetail.runs[0];
        const detail = await getRun(run.id);
        if (!detail.messages?.length) return;

        const isFinished = detail.status === 'converged' || detail.status === 'completed';
        const appStatus: AppStatus = isFinished ? 'completed' : 'idle';

        restoreSession(
          detail.session_id || sDetail.id,
          detail.id,
          detail.messages,
          isFinished
            ? {
                requirement: detail.requirement,
                pm_document: detail.pm_document,
                code: detail.code,
                review: detail.review,
                approved: detail.approved,
                status: detail.status,
              }
            : null,
          appStatus,
        );
      } catch {
        // 静默失败，显示空状态即可
      }
    })();
  }, [restoreSession]);

  const handleSend = async (text: string) => {
    await submitRequirement(text);
  };

  return (
    <div className="app-layout">
      <Sidebar onOpenSettings={() => setShowConfig(true)} />
      <main className="main-area">
        {error && (
          <div className="error-banner-container">
            <div className="error-banner">⚠️ {error}</div>
          </div>
        )}
        <ChatMessages
          messages={messages}
          result={result}
          loading={loading}
          status={status}
          error={error}
          currentRole={currentRole}
        />
        <ChatInput onSend={handleSend} loading={loading} />
      </main>
      {showConfig && <ConfigPanel onClose={() => setShowConfig(false)} />}
    </div>
  );
}
