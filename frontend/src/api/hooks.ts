import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import * as api from './client';
import { useAuth } from '../components/auth';
import type { ModelOption } from '../types/input';

// ---- 会话 ----

export function useSessions(limit = 50, agent_id?: string) {
  return useQuery({
    queryKey: ['sessions', limit, agent_id],
    queryFn: () => api.listSessions(limit, agent_id),
    staleTime: 30_000,
  });
}

export function useSessionDetail(sessionId: string | undefined) {
  return useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => api.getSessionDetail(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ title, agent_id }: { title: string; agent_id?: string }) => api.createSession(title, agent_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sessions'] }),
  });
}

// ---- 运行 ----

export function useRuns(limit = 20) {
  return useQuery({
    queryKey: ['runs', limit],
    queryFn: () => api.listRuns(limit),
    staleTime: 30_000,
  });
}

export function useRun(runId: string | undefined) {
  return useQuery({
    queryKey: ['run', runId],
    queryFn: () => api.getRun(runId!),
    enabled: !!runId,
    staleTime: 30_000,
  });
}

// ---- Agent ----

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => api.listAgents(),
    staleTime: 60_000,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: {
      name: string;
      role_identifier: string;
      system_prompt: string;
      order: number;
      is_active: boolean;
      is_approver: boolean;
      icon: string;
      model?: string | null;
      temperature?: number | null;
    }) => api.createAgent(cfg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...cfg
    }: {
      id: string;
      name?: string;
      system_prompt?: string;
      order?: number;
      is_active?: boolean;
      is_approver?: boolean;
      icon?: string;
      model?: string | null;
      temperature?: number | null;
    }) => api.updateAgent(id, cfg),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAgent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

export function useToggleAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.toggleAgent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });
}

// ---- 命令 ----

export function useCommands() {
  return useQuery({
    queryKey: ['commands'],
    queryFn: () => api.listCommands(),
    staleTime: 5 * 60_000,
  });
}

// ---- 可用模型（服务端 key vault + 后端 models API） ----

/**
 * 返回来自服务端 key vault 的可用模型。
 *
 * 企业架构将 API key 存在服务端。该 hook 从 GET /api/keys 拉取 key 列表
 * 并提取可用模型，同时合并 GET /api/models（服务端环境变量兜底）。
 */
export function useAvailableModels(): ModelOption[] {
  const { isAuthenticated } = useAuth();
  const { data: apiModels } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.listModels(),
    // 未认证的 GET 后端返回 200 []——仅在认证建立后才查询，
    // 避免认证前的空结果被缓存。
    enabled: isAuthenticated,
    staleTime: 0,
    gcTime: 30_000,
  });

  const { data: keys } = useQuery({
    queryKey: ['keys'],
    queryFn: () => api.listKeys(),
    // 未认证的 GET 后端返回 200 []——仅在认证建立后才查询，
    // 避免认证前的空结果被缓存。
    enabled: isAuthenticated,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const seen = new Set<string>();
  const models: ModelOption[] = [];

  // 1. 后端 /api/models（服务端环境变量兜底）
  if (apiModels) {
    for (const m of apiModels) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      models.push({ id: m.id, label: m.label, provider: m.provider });
    }
  }

  // 2. 服务端 key vault——激活的 key 及其模型
  if (keys) {
    for (const k of keys) {
      if (!k.is_active) continue;
      for (const modelId of k.models) {
        if (seen.has(modelId)) continue;
        seen.add(modelId);
        models.push({ id: modelId, label: modelId, provider: k.provider });
      }
    }
  }

  return models;
}

// ---- 预取 ----

export async function prefetchAgents(queryClient: QueryClient): Promise<void> {
  try {
    await queryClient.prefetchQuery({
      queryKey: ['agents'],
      queryFn: () => api.listAgents(),
      staleTime: 60_000,
    });
  } catch {
    // 非致命，忽略
  }
}
