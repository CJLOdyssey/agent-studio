/** Generic CRUD API service interface for workstation modules. */
export interface CrudAPIService<TEntry, TForm = Partial<TEntry>> {
  fetchAll(): Promise<TEntry[]>;
  create(data: TForm): Promise<TEntry>;
  update(id: string, data: Partial<TEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  clone(item: TEntry): Promise<TEntry>;
  removeBatch(ids: Set<string>): Promise<void>;
}

/**
 * Creates a module-level `api` reference + `setAPI` function with ES-module
 * live-binding support.
 *
 * Use in each CRUD api.ts — consumers import `{ xxxAPI, setXxxAPI }` where
 * `xxxAPI` is the live bound export alias:
 *
 * ```ts
 * // api.ts
 * import { defineCrudModule } from '../shared/api-base';
 *
 * const { bind, setAPI } = defineCrudModule<XxxEntry, XxxForm>(impl);
 * export const xxxAPI = bind;
 * export { setAPI as setXxxAPI };
 * ```
 */
export function defineCrudModule<TEntry, TForm = Partial<TEntry>>(
  impl: CrudAPIService<TEntry, TForm>,
): {
  /** A getter proxy — always reads the current implementation. */
  bind: CrudAPIService<TEntry, TForm>;
  /** Swap the implementation (for tests). */
  setAPI(next: CrudAPIService<TEntry, TForm>): void;
} {
  let current = impl;
  return {
    bind: new Proxy<CrudAPIService<TEntry, TForm>>(
      {} as CrudAPIService<TEntry, TForm>,
      {
        get(_target, prop: string | symbol) {
          const val = (current as Record<string | symbol, unknown>)[prop];
          return typeof val === 'function' ? val.bind(current) : val;
        },
      },
    ),
    setAPI(next) {
      current = next;
    },
  };
}
