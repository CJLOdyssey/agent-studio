export default function ConfigPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="config-overlay" onClick={onClose}>
      <div className="config-modal" onClick={(e) => e.stopPropagation()}>
        <h3>⚙️ 配置</h3>
        <p className="config-hint">
          配置项通过后端环境变量管理 (DEEPSEEK_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL, MAX_ROUNDS)
        </p>
        <div className="config-actions">
          <button className="config-btn config-btn-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
