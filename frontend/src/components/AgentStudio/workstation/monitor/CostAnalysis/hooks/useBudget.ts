import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchBudgetStatus,
  updateBudget,
  type BudgetStatus,
} from '../../../../../../api/client/cost';
import { costKeys } from './costQueryKeys';

export interface BudgetInput {
  dailyLimit: number;
  monthlyLimit: number;
}

export interface UseBudgetResult {
  budget: BudgetStatus | null;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  save: (input: BudgetInput) => Promise<void>;
}

/**
 * 预算读取与保存。
 *
 * 保存成功后直接写缓存并失效查询，让告警横幅与进度条即时反映新限额；
 * 失败时由调用方通过 error 提示，缓存保持原值。
 */
export function useBudget(): UseBudgetResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: costKeys.budget(),
    queryFn: fetchBudgetStatus,
  });

  const mutation = useMutation({
    mutationFn: ({ dailyLimit, monthlyLimit }: BudgetInput) =>
      updateBudget(dailyLimit, monthlyLimit),
    onSuccess: (_data, variables) => {
      const current = queryClient.getQueryData<BudgetStatus>(costKeys.budget());
      if (current) {
        queryClient.setQueryData<BudgetStatus>(costKeys.budget(), {
          ...current,
          daily_limit: variables.dailyLimit,
          monthly_limit: variables.monthlyLimit,
          daily_exceeded:
            variables.dailyLimit > 0 && current.daily_spend > variables.dailyLimit,
          monthly_exceeded:
            variables.monthlyLimit > 0 && current.monthly_spend > variables.monthlyLimit,
          daily_percent:
            variables.dailyLimit > 0
              ? Math.round((current.daily_spend / variables.dailyLimit) * 1000) / 10
              : 0,
          monthly_percent:
            variables.monthlyLimit > 0
              ? Math.round((current.monthly_spend / variables.monthlyLimit) * 1000) / 10
              : 0,
        });
      }
      queryClient.invalidateQueries({ queryKey: costKeys.budget() });
    },
  });

  return {
    budget: query.data ?? null,
    isLoading: query.isPending,
    isSaving: mutation.isPending,
    error: (mutation.error as Error | null) ?? null,
    save: async (input) => {
      await mutation.mutateAsync(input);
    },
  };
}
