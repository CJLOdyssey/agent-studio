import { useState, useCallback, useMemo, useEffect } from 'react';
import { getPreferences, setPreference } from '../../api/client/preferences';

export interface ModelSyncResult {
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  effectiveSelectedModel: string;
  ensureModelPersisted: () => void;
}

export function useModelSync(models: { id: string }[]): ModelSyncResult {
  const [selectedModel, setSelectedModelState] = useState(() => {
    try {
      return localStorage.getItem('agentstudio-selected-model') || '';
    } catch {
      return '';
    }
  });

  const effectiveSelectedModel = useMemo(() => {
    if (selectedModel && models.some((m) => m.id === selectedModel)) return selectedModel;
    try {
      const raw = localStorage.getItem('agentstudio-recent-models');
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const recent = parsed.find((x): x is string => typeof x === 'string' && models.some((m) => m.id === x));
        if (recent) return recent;
      }
    } catch {
      // non-fatal
    }
    return '';
  }, [selectedModel, models]);

  const setSelectedModel = useCallback((id: string) => {
    setSelectedModelState(id);
    try {
      localStorage.setItem('agentstudio-selected-model', id);
    } catch {
      // localStorage unavailable
    }
    setPreference('selected_model', id).catch(() => {});
  }, []);

  const ensureModelPersisted = useCallback(() => {
    const effective = effectiveSelectedModel;
    if (effective) {
      try {
        localStorage.setItem('agentstudio-selected-model', effective);
      } catch {
        // non-fatal
      }
    }
  }, [effectiveSelectedModel]);

  // 模型偏好 server 优先：localStorage 即时渲染（快），server GET 返回后覆盖
  // （跨设备一致——换设备/清缓存后恢复上次选择，杜绝回退默认模型的 402）。
  useEffect(() => {
    let cancelled = false;
    getPreferences().then((prefs) => {
      if (cancelled) return;
      const serverModel = prefs.selected_model;
      if (typeof serverModel === 'string' && serverModel) {
        setSelectedModelState(serverModel);
        try { localStorage.setItem('agentstudio-selected-model', serverModel); } catch { /* non-fatal */ }
      }
    }).catch(() => { /* non-fatal — localStorage 兜底 */ });
    return () => { cancelled = true; };
  }, []);

  return { selectedModel, setSelectedModel, effectiveSelectedModel, ensureModelPersisted };
}
