import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseAvailableModels = vi.fn().mockReturnValue([]);

vi.mock('../../../../api/hooks', () => ({
  useAvailableModels: () => mockUseAvailableModels(),
}));

import { MODEL_OPTIONS, PAGE_SIZE, useModelOptions } from '../constants';

describe('PAGE_SIZE', { tags: ['integration'] }, () => {
  it('is 5', () => {
    expect(PAGE_SIZE).toBe(5);
  });
});

describe('MODEL_OPTIONS', { tags: ['integration'] }, () => {
  it('contains expected models', () => {
    expect(MODEL_OPTIONS).toContain('GPT-4o');
    expect(MODEL_OPTIONS).toContain('DeepSeek V3');
    expect(MODEL_OPTIONS).toHaveLength(6);
  });
});

describe('useModelOptions', { tags: ['integration'] }, () => {
  beforeEach(() => {
    mockUseAvailableModels.mockReset();
  });

  it('returns default options when no API models', () => {
    mockUseAvailableModels.mockReturnValue([]);
    const { result } = renderHook(() => useModelOptions());
    expect(result.current).toEqual(MODEL_OPTIONS);
  });

  it('returns API models when available', () => {
    mockUseAvailableModels.mockReturnValue([{ id: 'custom-model' }]);
    const { result } = renderHook(() => useModelOptions());
    expect(result.current).toEqual(['custom-model']);
  });
});
