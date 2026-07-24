import { describe, it, expect, vi } from 'vitest';
import { defineCrudModule } from '../api-base';
import type { CrudAPIService } from '../api-base';

interface TestEntry {
  id: string;
  name: string;
}

type TestForm = Omit<TestEntry, 'id'>;

const makeImpl = (): CrudAPIService<TestEntry, TestForm> => ({
  fetchAll: vi.fn<() => Promise<TestEntry[]>>(),
  create: vi.fn<(data: TestForm) => Promise<TestEntry>>(),
  update: vi.fn<(id: string, data: Partial<TestEntry>) => Promise<void>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
  clone: vi.fn<(item: TestEntry) => Promise<TestEntry>>(),
  removeBatch: vi.fn<(ids: Set<string>) => Promise<void>>(),
});

describe('defineCrudModule', { tags: ['unit'] }, () => {
  it('returns bind and setAPI', () => {
    const impl = makeImpl();
    const result = defineCrudModule<TestEntry, TestForm>(impl);
    expect(result).toHaveProperty('bind');
    expect(result).toHaveProperty('setAPI');
  });

  describe('bind (proxy)', () => {
    it('delegates fetchAll to the current implementation', async () => {
      const impl = makeImpl();
      const entries: TestEntry[] = [{ id: '1', name: 'one' }];
      impl.fetchAll.mockResolvedValue(entries);

      const { bind } = defineCrudModule<TestEntry, TestForm>(impl);
      const result = await bind.fetchAll();

      expect(impl.fetchAll).toHaveBeenCalledOnce();
      expect(result).toEqual(entries);
    });

    it('delegates create to the current implementation', async () => {
      const impl = makeImpl();
      const entry: TestEntry = { id: '1', name: 'new' };
      impl.create.mockResolvedValue(entry);

      const { bind } = defineCrudModule<TestEntry, TestForm>(impl);
      const result = await bind.create({ name: 'new' });

      expect(impl.create).toHaveBeenCalledWith({ name: 'new' });
      expect(result).toEqual(entry);
    });

    it('delegates update to the current implementation', async () => {
      const impl = makeImpl();
      impl.update.mockResolvedValue(undefined);

      const { bind } = defineCrudModule<TestEntry, TestForm>(impl);
      await bind.update('1', { name: 'updated' });

      expect(impl.update).toHaveBeenCalledWith('1', { name: 'updated' });
    });

    it('delegates remove to the current implementation', async () => {
      const impl = makeImpl();
      impl.remove.mockResolvedValue(undefined);

      const { bind } = defineCrudModule<TestEntry, TestForm>(impl);
      await bind.remove('1');

      expect(impl.remove).toHaveBeenCalledWith('1');
    });

    it('delegates clone to the current implementation', async () => {
      const impl = makeImpl();
      const original: TestEntry = { id: '1', name: 'original' };
      const cloned: TestEntry = { id: '2', name: 'original' };
      impl.clone.mockResolvedValue(cloned);

      const { bind } = defineCrudModule<TestEntry, TestForm>(impl);
      const result = await bind.clone(original);

      expect(impl.clone).toHaveBeenCalledWith(original);
      expect(result).toEqual(cloned);
    });

    it('delegates removeBatch to the current implementation', async () => {
      const impl = makeImpl();
      impl.removeBatch.mockResolvedValue(undefined);

      const ids = new Set(['1', '2', '3']);
      const { bind } = defineCrudModule<TestEntry, TestForm>(impl);
      await bind.removeBatch(ids);

      expect(impl.removeBatch).toHaveBeenCalledWith(ids);
    });
  });

  describe('setAPI', () => {
    it('swaps implementation so subsequent calls use the new impl', async () => {
      const impl1 = makeImpl();
      impl1.fetchAll.mockResolvedValue([{ id: 'a', name: 'first' }]);

      const impl2 = makeImpl();
      impl2.fetchAll.mockResolvedValue([{ id: 'b', name: 'second' }]);

      const { bind, setAPI } = defineCrudModule<TestEntry, TestForm>(impl1);
      setAPI(impl2);

      const result = await bind.fetchAll();
      expect(result).toEqual([{ id: 'b', name: 'second' }]);
      expect(impl1.fetchAll).not.toHaveBeenCalled();
      expect(impl2.fetchAll).toHaveBeenCalledOnce();
    });

    it('swapping then reverting restores the original implementation', async () => {
      const impl1 = makeImpl();
      impl1.fetchAll.mockResolvedValue([{ id: 'a', name: 'first' }]);

      const impl2 = makeImpl();
      impl2.fetchAll.mockResolvedValue([{ id: 'b', name: 'second' }]);

      const { bind, setAPI } = defineCrudModule<TestEntry, TestForm>(impl1);
      setAPI(impl2);
      setAPI(impl1);

      const result = await bind.fetchAll();
      expect(result).toEqual([{ id: 'a', name: 'first' }]);
      expect(impl1.fetchAll).toHaveBeenCalledOnce();
      expect(impl2.fetchAll).not.toHaveBeenCalled();
    });

    it('setAPI swap affects all methods, not just fetchAll', async () => {
      const impl1 = makeImpl();
      const impl2 = makeImpl();
      impl2.create.mockResolvedValue({ id: 'x', name: 'from-two' });

      const { bind, setAPI } = defineCrudModule<TestEntry, TestForm>(impl1);
      setAPI(impl2);

      await bind.create({ name: 'test' });
      expect(impl1.create).not.toHaveBeenCalled();
      expect(impl2.create).toHaveBeenCalledWith({ name: 'test' });
    });
  });

  describe('proxy transparency', () => {
    it('allows reading non-function properties from the implementation', () => {
      const impl = {
        ...makeImpl(),
        baseURL: 'http://example.com/api',
      };
      const { bind } = defineCrudModule<TestEntry, TestForm>(impl);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((bind as any).baseURL).toBe('http://example.com/api');
    });

    it('preserves this binding for methods accessing instance state', async () => {
      const impl: CrudAPIService<TestEntry, TestForm> & { getPrefix(): string } = {
        prefix: 'test-',
        getPrefix() {
          return this.prefix;
        },
        fetchAll: vi.fn(function (this: typeof impl) {
          return Promise.resolve([{ id: `${this.getPrefix()}1`, name: 'one' }]);
        }),
        create: vi.fn(),
        update: vi.fn(),
        remove: vi.fn(),
        clone: vi.fn(),
        removeBatch: vi.fn(),
      };

      const { bind } = defineCrudModule<TestEntry, TestForm>(impl);
      const result = await bind.fetchAll();

      expect(result).toEqual([{ id: 'test-1', name: 'one' }]);
    });
  });
});
