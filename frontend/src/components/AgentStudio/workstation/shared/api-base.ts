/** 工作站模块的通用 CRUD API 服务接口。 */
export interface CrudAPIService<TEntry, TForm = Partial<TEntry>> {
  fetchAll(): Promise<TEntry[]>;
  create(data: TForm): Promise<TEntry>;
  update(id: string, data: Partial<TEntry>): Promise<void>;
  remove(id: string): Promise<void>;
  clone(item: TEntry): Promise<TEntry>;
  removeBatch(ids: Set<string>): Promise<void>;
}

/**
 * 创建模块级 `api` 引用 + `setAPI` 函数，支持 ES 模块 live-binding。
 *
 * 在各 CRUD 的 api.ts 中使用——消费方导入 `{ xxxAPI, setXxxAPI }`，
 * 其中 `xxxAPI` 是 live bound 的导出别名：
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
  /** 一个 getter 代理——始终读取当前实现。 */
  bind: CrudAPIService<TEntry, TForm>;
  /** 替换实现（供测试用）。 */
  setAPI(next: CrudAPIService<TEntry, TForm>): void;
} {
  let current = impl;
  return {
    bind: new Proxy<CrudAPIService<TEntry, TForm>>(
      {} as CrudAPIService<TEntry, TForm>,
      {
        get(_target, prop: string | symbol) {
          const val = Reflect.get(current, prop);
          return typeof val === 'function' ? val.bind(current) : val;
        },
      },
    ),
    setAPI(next) {
      current = next;
    },
  };
}
