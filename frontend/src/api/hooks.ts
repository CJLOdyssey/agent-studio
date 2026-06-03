import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import * as api from './client';
import type { ModelOption } from '../types/input';

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

// ---- Available Models (server key vault + backend models API) ----

/**
 * Returns available models from the server-side key vault.
 *
 * The enterprise architecture stores API keys server-side. This hook
 * fetches the key list from GET /api/keys and extracts available models.
 * Also merges GET /api/models (server env var fallback).
 */
export function useAvailableModels(): ModelOption[] {
  const { data: apiModels } = useQuery({
    queryKey: ['models'],
    queryFn: () => api.listModels(),
    staleTime: 0,
    gcTime: 30_000,
  });

  const { data: keys } = useQuery({
    queryKey: ['keys'],
    queryFn: () => api.listKeys(),
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const seen = new Set<string>();
  const models: ModelOption[] = [];

  // 1. Backend /api/models (server env var fallback)
  if (apiModels) {
    for (const m of apiModels) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      models.push({ id: m.id, label: m.label, provider: m.provider });
    }
  }

  // 2. Server key vault — active keys with their models
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
