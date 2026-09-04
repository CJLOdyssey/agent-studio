import { describe, it, expect } from 'vitest';
import {
  calculateCostMetrics,
  getBudgetAlert,
  isBudgetConfigured,
  niceStep,
} from './costUtils';

describe('niceStep', () => {
  it('returns 1 for zero or invalid input', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-1)).toBe(1);
  });
  it('produces 1/2/5 x 10^n steps', () => {
    // 输入 rough = maxValue / 5；factor 选最贴近 5/2/1 的 nice 倍数
    expect(niceStep(25)).toBe(5); // 25/5=5 → magnitude=1, factor=5
    expect(niceStep(95)).toBe(10); // 95/5=19 → magnitude=10, factor=1 (1.9 < 2)
    expect(niceStep(125)).toBe(20); // 125/5=25 → magnitude=10, factor=2 (2.5 < 5)
  });
});

describe('calculateCostMetrics', () => {
  it('computes avg, top model and daily cost', () => {
    const summary = {
      period_days: 7,
      total_tokens: 1000,
      total_cost_usd: 0.01,
      total_prompt_tokens: 600,
      total_completion_tokens: 400,
      total_calls: 2,
      by_model: { m1: { tokens: 1000, cost_usd: 0.01, calls: 2 } },
      by_node: {},
      by_user: {},
    };
    const m = calculateCostMetrics(summary, 7);
    expect(m.avgCostPerCall).toBeCloseTo(0.005, 6);
    expect(m.modelCount).toBe(1);
    expect(m.topModel?.name).toBe('m1');
    expect(m.avgDailyCost).toBeCloseTo(0.01 / 7, 6);
  });
});

describe('getBudgetAlert / isBudgetConfigured', () => {
  it('returns null when limit is 0', () => {
    const b = {
      daily_limit: 0,
      monthly_limit: 0,
      daily_spend: 1,
      monthly_spend: 1,
      daily_exceeded: false,
      monthly_exceeded: false,
      daily_percent: 0,
      monthly_percent: 0,
    };
    expect(getBudgetAlert(b)).toBeNull();
    expect(isBudgetConfigured(b)).toBe(false);
  });
  it('returns danger when daily exceeded', () => {
    const b = {
      daily_limit: 1,
      monthly_limit: 0,
      daily_spend: 5,
      monthly_spend: 5,
      daily_exceeded: true,
      monthly_exceeded: false,
      daily_percent: 500,
      monthly_percent: 0,
    };
    expect(getBudgetAlert(b)?.type).toBe('danger');
  });
});