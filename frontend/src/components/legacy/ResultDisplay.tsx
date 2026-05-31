import { useState } from 'react';
import type { RunResult } from '../../types';

interface Props {
  result: RunResult;
}

export default function ResultDisplay({ result }: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    document: true,
    code: false,
    review: false,
  });

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const statusIcon = result.approved ? '✅' : '❌';
  const statusText = result.approved ? '通过' : '驳回';

  return (
    <div className="result-panel">
      <div className={`result-badge ${result.approved ? 'approved' : 'rejected'}`}>
        {statusIcon} 讨论结果: {statusText}
      </div>

      <div className="result-section">
        <button className="result-section-header" onClick={() => toggle('document')} aria-expanded={openSections.document} aria-controls="result-document">
          📋 需求文档
          <span className={`result-section-arrow ${openSections.document ? 'open' : ''}`}>▼</span>
        </button>
        {openSections.document && (
          <div className="result-section-body result-section-pre" id="result-document">
            {result.pm_document || '无'}
          </div>
        )}
      </div>

      <div className="result-section">
        <button className="result-section-header" onClick={() => toggle('code')} aria-expanded={openSections.code} aria-controls="result-code">
          💻 代码产出
          <span className={`result-section-arrow ${openSections.code ? 'open' : ''}`}>▼</span>
        </button>
        {openSections.code && (
          <div className="result-section-body result-section-pre" id="result-code">
            {result.code || '无'}
          </div>
        )}
      </div>

      <div className="result-section">
        <button className="result-section-header" onClick={() => toggle('review')} aria-expanded={openSections.review} aria-controls="result-review">
          🧪 测试评审
          <span className={`result-section-arrow ${openSections.review ? 'open' : ''}`}>▼</span>
        </button>
        {openSections.review && (
          <div className="result-section-body result-section-pre" id="result-review">
            {result.review || '无'}
          </div>
        )}
      </div>
    </div>
  );
}
