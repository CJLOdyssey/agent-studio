import { useState } from 'react';
import { LLMTraceList } from './LLMTraceList';
import { LLMTraceDetail } from './LLMTraceDetail';

/** 运行轨迹（LLM Trace 浏览器）：列表 ⇄ 详情 由本地 state 切换（与 monitor 体系一致）。 */
export default function LLMTraces() {
  const [runId, setRunId] = useState<string | null>(null);
  return runId ? (
    <LLMTraceDetail runId={runId} onBack={() => setRunId(null)} />
  ) : (
    <LLMTraceList onOpenTrace={setRunId} />
  );
}
