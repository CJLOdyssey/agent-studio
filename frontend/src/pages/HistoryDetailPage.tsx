import { useEffect, useState } from 'react';
import Sidebar from '../components/legacy/Sidebar';
import ConfigPanel from '../components/shared/ConfigPanel';
import ChatMessages from '../components/legacy/ChatMessages';
import ChatInput from '../components/legacy/ChatInput';
import { getRun } from '../api/client';
import { useChatStore } from '../stores/chatStore';
import type { ChatMessage, ProjectRun } from '../types';

interface Props {
  id: string | undefined;
}

export default function HistoryDetailPage({ id }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [result, setResult] = useState<ProjectRun | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitRequirement = useChatStore((s) => s.submitRequirement);
  const storeStatus = useChatStore((s) => s.status);
  const loading = storeStatus === 'loading' || storeStatus === 'running';

  useEffect(() => {
    if (!id) return;
    getRun(id).then((run) => {
      setMessages(run.messages ?? []);
      setResult(run);
    }).catch(() => setError('加载失败'));
  }, [id]);

  const handleSend = async (text: string) => {
    setError(null);
    try {
      await submitRequirement(text, undefined);
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    }
  };

  const runResult = result
    ? {
        requirement: result.requirement,
        pm_document: result.pm_document,
        code: result.code,
        review: result.review,
        approved: result.approved,
        status: result.status,
      }
    : null;

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
          result={runResult}
          loading={loading}
          status={storeStatus}
          error={error}
        />
        <ChatInput onSend={handleSend} loading={loading} />
      </main>
      {showConfig && <ConfigPanel onClose={() => setShowConfig(false)} />}
    </div>
  );
}
