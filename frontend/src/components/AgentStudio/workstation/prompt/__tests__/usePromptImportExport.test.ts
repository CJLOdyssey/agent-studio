import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePromptImportExport } from '../usePromptImportExport';
import type { PromptEntry } from '../types';

const mockEntry = (id: string): PromptEntry => ({
  id, name: `p${id}`, content: 'test', category: '系统提示词', model: 'GPT-4o', status: 'active', version: 'v1.0.0', createdAt: '2026-06-01',
});

describe('usePromptImportExport', () => {
  it('export calls getAllItems and creates blob URL', () => {
    const items = [mockEntry('1'), mockEntry('2')];
    const getAll = vi.fn(() => items);
    const addItems = vi.fn();
    const { result } = renderHook(() => usePromptImportExport(getAll, addItems));

    expect(() => result.current.exportPrompts()).not.toThrow();
    expect(getAll).toHaveBeenCalledOnce();
  });

  it('import accepts valid entries', () => {
    const existing = [mockEntry('1')];
    const getAll = vi.fn(() => existing);
    const addItems = vi.fn();
    const { result } = renderHook(() => usePromptImportExport(getAll, addItems));

    const newEntry = mockEntry('2');
    const res = result.current.importPrompts([newEntry]);
    expect(res.success).toBe(true);
    expect(addItems).toHaveBeenCalledWith([newEntry]);
  });

  it('import rejects non-array input', () => {
    const { result } = renderHook(() => usePromptImportExport(
      () => [], vi.fn(),
    ));
    const res = result.current.importPrompts({} as unknown[]);
    expect(res.success).toBe(false);
  });

  it('import rejects invalid entry', () => {
    const { result } = renderHook(() => usePromptImportExport(
      () => [], vi.fn(),
    ));
    const res = result.current.importPrompts([{ id: '1' }] as unknown[]);
    expect(res.success).toBe(false);
  });

  it('import skips duplicates', () => {
    const existing = [mockEntry('1')];
    const getAll = vi.fn(() => existing);
    const addItems = vi.fn();
    const { result } = renderHook(() => usePromptImportExport(getAll, addItems));

    const dup = mockEntry('1');
    const res = result.current.importPrompts([dup]);
    expect(res.success).toBe(false); // all duplicates
    expect(addItems).not.toHaveBeenCalled();
  });

  it('import merges new + skips duplicates', () => {
    const existing = [mockEntry('1')];
    const getAll = vi.fn(() => existing);
    const addItems = vi.fn();
    const { result } = renderHook(() => usePromptImportExport(getAll, addItems));

    const res = result.current.importPrompts([mockEntry('1'), mockEntry('2')]);
    expect(res.success).toBe(true);
    expect(addItems).toHaveBeenCalledWith([mockEntry('2')]);
  });
});
