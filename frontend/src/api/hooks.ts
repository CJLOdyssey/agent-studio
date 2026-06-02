import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import * as api from './client';
import type { ModelOption } from '../types/input';
import { getAndDecrypt } from '../utils/secureStorage';

// ---- Sessions ----

export function useSessions(limit = 50) {
  return useQuery({
    queryKey: ['sessions', limit],
    queryFn: () => api.listSessions(limit),
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
    mutationFn: (title: string) => api.createSession(title),
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

// ---- Runs ----

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

// ---- Agents ----

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
    mutationFn: ({ id, ...cfg }: {
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

// ---- Commands ----

export function useCommands() {
  return useQuery({
    queryKey: ['commands'],
    queryFn: () => api.listCommands(),
    staleTime: 5 * 60_000,
  });
}

// ---- Available Models (backend API + localStorage providers) ----

interface StoredProvider {
  id: string;
  name: string;
  models: string[];
  isActive: boolean;
}

/**
 * Returns available models from TWO sources, merged:
 *
 *   1. Backend GET /api/models (server-side, from environment variables)
 *   2. ApiManagementModal localStorage config (user-configured providers)
 *
 * The backend is authoritative for server-managed models. The localStorage
 * fallback covers the case where the user configured providers in the UI
 * but the backend hasn't been set up with env vars yet.
 */
export function useAvailableModels(): ModelOption[] {
  const { data: apiModels } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.listModels(),
    staleTime: 0,        // always refetch on mount — user may have just configured
    gcTime: 30_000,      // keep in cache for 30s after unmount
  });

  // Compute inline (no useMemo) — localStorage read must happen on every render
  // so the list updates immediately after ApiManagementModal saves changes.
  const seen = new Set<string>();
  const models: ModelOption[] = [];

  // 1. Backend API models (authoritative)
  if (apiModels) {
    for (const m of apiModels) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      models.push({ id: m.id, label: m.label, provider: m.provider });
    }
  }

  // 2. localStorage: user-configured providers from ApiManagementModal
  try {
    const raw = getAndDecrypt('devagents-api-providers');
    if (raw) {
      const providers: StoredProvider[] = JSON.parse(raw);
      for (const p of providers) {
        if (!p.isActive) continue;
        for (const modelId of p.models) {
          if (seen.has(modelId)) continue;
          seen.add(modelId);
          models.push({ id: modelId, label: modelId, provider: p.name });
        }
      }
    }
  } catch {
    // localStorage parse failed — ignore
  }

  return models;
}

// ---- Prefetch ----

export async function prefetchAgents(queryClient: QueryClient): Promise<void> {
  try {
    await queryClient.prefetchQuery({
      queryKey: ['agents'],
      queryFn: () => api.listAgents(),
      staleTime: 60_000,
    });
  } catch {
    // non-fatal
  }
}
