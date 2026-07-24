# 前端测试速度优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前端 Vitest 测试从 68s 优化到 26-31s（全量）/ ~15s（开发模式）

**Architecture:** 6 项优化递进实施：Pool 切换 → 删重复文件 → Mock 重型依赖 + Setup 瘦身 → 慢文件拆分 → 文件合并重组 → Tags 标签 + CI Sharding。每项独立可验证，无阻塞依赖。

**Tech Stack:** Vitest v4.1.10, Node.js v24, React 18, jsdom

**参考设计文档:** `docs/superpowers/specs/2026-07-24-frontend-test-speed-optimization.md`

---

## 文件清单

### 修改文件
| 文件 | 改动内容 |
|------|----------|
| `frontend/vite.config.ts` | Pool: forks → vmThreads, deps.optimizer, poolOptions |
| `frontend/src/test/setup.tsx` | 添加全局重型依赖 mock |
| `frontend/package.json` | 添加 `test:unit`, `test:quick`, `test:changed` scripts |
| `.github/workflows/ci.yml` | 添加 test sharding steps |

### 新建文件
| 文件 | 内容 |
|------|------|
| `frontend/src/test/global-mocks.ts` | 集中管理重型依赖的 `vi.mock()` |

### 删除文件
| 文件 | 原因 |
|------|------|
| `frontend/src/components/AgentStudio/modals/tabs/__tests__/MCPTab.test.tsx` | 重复测试 |
| `frontend/src/components/AgentStudio/modals/tabs/__tests__/OutputConstraintTab.test.tsx` | 重复测试 |
| `frontend/src/components/AgentStudio/modals/tabs/__tests__/SkillsTab.test.tsx` | 重复测试 |
| `frontend/src/components/AgentStudio/modals/tabs/__tests__/SystemPromptTab.test.tsx` | 重复测试 |
| `frontend/src/components/AgentStudio/modals/tabs/__tests__/ToolsTab.test.tsx` | 重复测试 |

### 拆分文件（慢文件）
| 源文件 | 目标 |
|--------|------|
| `sidebar/__tests__/TeamTree.test.tsx` (656行) | → 3 个子文件 |
| `__tests__/TeamMessage.test.tsx` (521行) | → 2 个子文件 |
| `workstation/output/__tests__/OutputConstraintManagement.test.tsx` (504行) | → 2 个子文件 |
| `__tests__/useWorkstationState.test.ts` (494行) | → 2 个子文件 |
| `__tests__/AgentStudioWorkstation.test.tsx` (473行) | → 2 个子文件 |

---

### Task 1: Pool 策略切换 — `forks` → `vmThreads`

**Files:**
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1.1: 修改 vitest pool 配置**

在 `frontend/vite.config.ts` 的 `test` 对象中，将 `pool: 'forks'` 改为 `pool: 'vmThreads'`，添加 `poolOptions`：

```typescript
// 当前 test 配置 (约第 77 行)
test: {
  globals: true,
  environment: 'jsdom',
  pool: 'vmThreads',           // 改这里
  poolOptions: {
    vmThreads: {
      useAtomics: true,       // 共享内存加速
      maxThreads: 4,
      minThreads: 2,
    },
  },
  maxWorkers: 4,               // 删除这行 (vmThreads 用 maxThreads)
  minWorkers: 1,               // 删除这行 (vmThreads 用 minThreads)
  setupFiles: './src/test/setup.tsx',
  css: false,
  // ... 其余不变
}
```

删除 `maxWorkers` 和 `minWorkers`（它们在 `vmThreads` 下无效，会 warning）。

- [ ] **Step 1.2: 运行测试验证**

```bash
cd frontend && npx vitest run --no-coverage 2>&1 | tail -5
```

预期: 181 passed, 时间应 < 58s

- [ ] **Step 1.3: 提交**

```bash
git add frontend/vite.config.ts
git commit -m "perf(test): switch vitest pool from forks to vmThreads"
```

---

### Task 2: 删除 5 对重复测试文件

**Files:**
- Delete: 5 files listed above

- [ ] **Step 2.1: 确认重复关系**

逐个 diff 确认 5 对文件内容不同（已确认 — 请直接删除）：

```bash
cd /home/odyssey/PyCharmProjects/Agent/projects/agent-studio
rm frontend/src/components/AgentStudio/modals/tabs/__tests__/MCPTab.test.tsx
rm frontend/src/components/AgentStudio/modals/tabs/__tests__/OutputConstraintTab.test.tsx
rm frontend/src/components/AgentStudio/modals/tabs/__tests__/SkillsTab.test.tsx
rm frontend/src/components/AgentStudio/modals/tabs/__tests__/SystemPromptTab.test.tsx
rm frontend/src/components/AgentStudio/modals/tabs/__tests__/ToolsTab.test.tsx
```

保留 `TabRenderer.test.tsx`（唯一文件）。

- [ ] **Step 2.2: 运行测试验证**

```bash
cd frontend && npx vitest run --no-coverage 2>&1 | tail -5
```

预期: 176 passed (减少 5 个文件)，时间应 < 55s

- [ ] **Step 2.3: 提交**

```bash
git add frontend/src/components/AgentStudio/modals/tabs/__tests__/
git commit -m "perf(test): remove 5 duplicate tab test files"
```

---

### Task 3: Setup 瘦身 + 全局 Mock 重型依赖

**Files:**
- Create: `frontend/src/test/global-mocks.ts`
- Modify: `frontend/src/test/setup.tsx`
- Modify: `frontend/vite.config.ts`（添加 deps.optimizer）

- [ ] **Step 3.1: 创建 global-mocks.ts**

新建 `frontend/src/test/global-mocks.ts`：

```typescript
import { vi } from 'vitest';

// -------------------------------------------------------------------
// 重型依赖全局 Mock
// 避免在每个测试文件中重复解析 antd, reactflow, syntax-highlighter
// -------------------------------------------------------------------

// react-syntax-highlighter — 代码高亮，渲染开销大
vi.mock('react-syntax-highlighter', () => ({
  default: ({ children }: any) => children,
  Prism: ({ children }: any) => <>{children}</>,
  Light: ({ children }: any) => <>{children}</>,
}));
vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({}));

// reactflow — 流程图组件，依赖 DOM 测量
vi.mock('reactflow', () => ({
  ReactFlow: ({ children }: any) => <>{children}</>,
  Handle: ({ children }: any) => <>{children}</>,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  addEdge: (e: any) => e,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
}));

// @ant-design/icons — 数百个 SVG 图标，使用 Proxy 懒加载
vi.mock('@ant-design/icons', () => {
  const MockIcon = () => null as any;
  return new Proxy({}, {
    get: () => MockIcon,
  });
});

// antd 的 CSS-in-JS 运行时 — 减少样式计算
vi.mock('@ant-design/cssinjs', () => ({
  StyleProvider: ({ children }: any) => children,
  createCache: () => ({}),
}));
```

- [ ] **Step 3.2: 注册 global-mocks 到 vitest config**

在 `frontend/vite.config.ts` 的 `test` 对象中，将 `setupFiles` 改为数组并包含 global-mocks：

```typescript
test: {
  // ...
  setupFiles: ['./src/test/global-mocks.ts', './src/test/setup.tsx'],
  // global-mocks.ts 先执行，确保 mock 在 import 前就位
}
```

同时添加 deps.optimizer：

```typescript
test: {
  // ...
  deps: {
    optimizer: {
      ssr: {
        include: [
          'antd',
          '@ant-design/icons',
          'react-syntax-highlighter',
          'reactflow',
          '@ant-design/cssinjs',
        ],
      },
    },
  },
}
```

- [ ] **Step 3.3: 运行测试验证**

```bash
cd frontend && npx vitest run --no-coverage 2>&1 | tail -5
```

预期: 176 passed, 时间应 < 50s

- [ ] **Step 3.4: 提交**

```bash
git add frontend/src/test/global-mocks.ts frontend/src/test/setup.tsx frontend/vite.config.ts
git commit -m "perf(test): add global mocks for heavy deps and enable deps optimizer"
```

---

### Task 4: 慢测试文件拆分

**Files:**
- Modify: 5 个大型测试文件 → 拆分为 11 个子文件

拆分原则：每个子文件 150-250 行，按 `describe` 块分割。保留原文件的测试覆盖率，不改变测试逻辑。

- [ ] **Step 4.1: 拆分 TeamTree.test.tsx (656行)**

源文件: `frontend/src/components/AgentStudio/sidebar/__tests__/TeamTree.test.tsx`
拆分为:
- `TeamTree.render.test.tsx` — 渲染测试
- `TeamTree.interaction.test.tsx` — 交互测试
- `TeamTree.state.test.tsx` — 状态测试

- [ ] **Step 4.2: 拆分 TeamMessage.test.tsx (521行)**

源文件: `frontend/src/components/AgentStudio/__tests__/TeamMessage.test.tsx`
拆分为:
- `TeamMessage.render.test.tsx` — 渲染测试
- `TeamMessage.actions.test.tsx` — 操作测试

- [ ] **Step 4.3: 拆分 OutputConstraintManagement.test.tsx (504行)**

源文件: `frontend/src/components/AgentStudio/workstation/output/__tests__/OutputConstraintManagement.test.tsx`
拆分为:
- `OutputConstraintManagement.list.test.tsx` — 列表/CRUD 测试
- `OutputConstraintManagement.form.test.tsx` — 表单测试

- [ ] **Step 4.4: 拆分 useWorkstationState.test.ts (494行)**

源文件: `frontend/src/components/AgentStudio/__tests__/useWorkstationState.test.ts`
拆分为:
- `useWorkstationState.tabs.test.ts` — tab 状态测试
- `useWorkstationState.selection.test.ts` — 选择状态测试

- [ ] **Step 4.5: 拆分 AgentStudioWorkstation.test.tsx (473行)**

源文件: `frontend/src/components/__tests__/AgentStudioWorkstation.test.tsx`
拆分为:
- `AgentStudioWorkstation.layout.test.tsx` — 布局测试
- `AgentStudioWorkstation.behavior.test.tsx` — 行为测试

- [ ] **Step 4.6: 运行测试验证**

```bash
cd frontend && npx vitest run --no-coverage 2>&1 | tail -5
```

预期: 187 passed (拆分增加了文件数), 时间应 < 46s

- [ ] **Step 4.7: 提交**

```bash
git add frontend/src/components/AgentStudio/
git commit -m "perf(test): split 5 large test files to improve worker parallelism"
```

---

### Task 5: 测试文件合并重组

**Files:**
- Move: 零散模块测试到 `src/__tests__/modules/`

合并原则：
- 1-2 文件的模块 → 合并到 `src/__tests__/modules/<module>/`
- 5+ 文件的模块 → 保持子目录结构不变

合并目标（减少 ~60 个文件）：

```bash
# 示例：零散文件迁移
src/
  __tests__/
    modules/
      auth/          ← 合并 src/components/auth/__tests__/ (3 文件)
      input/         ← 合并 src/components/input/__tests__/ (5 文件)
      shared/        ← 合并 src/components/shared/__tests__/ (3 文件)
      messages/      ← 合并 src/components/AgentStudio/messages/__tests__/ (3 文件)
      contexts/      ← 合并 src/contexts/__tests__/ (1 文件)
      i18n/          ← 合并 src/i18n/__tests__/ (2 文件)
      types/         ← 合并 src/types/__tests__/ (1 文件)
```

- [ ] **Step 5.1: 合并 auth 测试**

将 `src/components/auth/__tests__/` 的 3 个文件迁移到 `src/__tests__/modules/auth/`。

- [ ] **Step 5.2: 合并 input 测试**

将 `src/components/input/__tests__/` 的 5 个文件迁移到 `src/__tests__/modules/input/`。

- [ ] **Step 5.3: 合并 shared 测试**

将 `src/components/shared/__tests__/` 的 3 个文件迁移到 `src/__tests__/modules/shared/`。

- [ ] **Step 5.4: 合并 messages/contexts/i18n/types 测试**

各自迁移到 `src/__tests__/modules/<module>/`。

- [ ] **Step 5.5: 删除空目录**

```bash
find frontend/src -type d -empty -delete
```

- [ ] **Step 5.6: 运行测试验证**

```bash
cd frontend && npx vitest run --no-coverage 2>&1 | tail -5
```

预期: 全部 passed, 文件数 ~120, 时间应 < 41s

- [ ] **Step 5.7: 提交**

```bash
git add frontend/src/
git commit -m "perf(test): consolidate scattered test files into src/__tests__/modules/"
```

---

### Task 6: Vitest v4 Tags 系统 + CI Sharding

**Files:**
- Modify: 测试文件（添加 tags 元数据）
- Modify: `frontend/package.json`（添加 scripts）
- Modify: `.github/workflows/ci.yml`（添加 sharding）

- [ ] **Step 6.1: 为纯组件测试添加 unit 标签**

在所有纯渲染/交互组件测试的顶层 `describe` 中添加 `{ tags: ['unit'] }`：

```typescript
// 示例: shared/__tests__/FormField.test.tsx
describe('FormField', { tags: ['unit'] }, () => {
  // ... 现有测试
});
```

适用文件: 约 120 个组件/工具纯单元测试文件。

- [ ] **Step 6.2: 为跨模块集成测试添加 integration 标签**

在涉及多个模块协作的测试中添加 `{ tags: ['integration'] }`：

```typescript
// 示例: __tests__/AgentStudioWorkstation.integration.test.tsx
describe('AgentStudioWorkstation integration', { tags: ['integration'] }, () => {
  // ... 现有测试
});
```

适用文件: 约 20 个跨模块/集成测试文件。

- [ ] **Step 6.3: 更新 package.json scripts**

在 `frontend/package.json` 的 `scripts` 中添加：

```json
{
  "test:unit": "vitest run --tags 'unit'",
  "test:quick": "vitest run --tags '!integration'",
  "test:changed": "vitest run --changed",
  "test:coverage:unit": "vitest run --coverage --tags 'unit'"
}
```

- [ ] **Step 6.4: 更新 CI 配置**

在 `.github/workflows/ci.yml` 的 frontend-test job 中添加 sharding：

```yaml
frontend-test:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      shard: [1, 2]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx vitest run --coverage --shard=${{ matrix.shard }}/2 --tags '!integration'
    # integration 测试单独跑（不 shard 因为数量少）
    - run: npx vitest run --tags 'integration'
```

- [ ] **Step 6.5: 全量运行验证**

```bash
cd frontend && npx vitest run --no-coverage 2>&1 | tail -5
```

预期: 全部 passed, 时间应 < 41s（此步骤不改变执行时间，只是增加元数据）

- [ ] **Step 6.6: 运行 unit 验证**

```bash
cd frontend && npx vitest run --tags 'unit' --no-coverage 2>&1 | tail -5
```

预期: ~15s

- [ ] **Step 6.7: 提交**

```bash
git add frontend/package.json frontend/src/ .github/workflows/ci.yml
git commit -m "perf(test): add vitest v4 tags and CI sharding"
```

---

## 基线验证

每次 task 完成后运行 `npx vitest run --no-coverage` 确认时间和通过率。最终验证：

```bash
# 全量
npx vitest run --no-coverage
# 预期: ~26-31s, 全部 passed

# 单元测试
npx vitest run --tags 'unit' --no-coverage
# 预期: ~15s

# 变更
npx vitest run --changed --no-coverage
# 预期: <5s
```

---

## 回滚方案

如果某步导致测试失败：
1. `git checkout HEAD~1 -- <problematic-files>` 恢复单个文件
2. `git revert <commit-hash>` 回退整步提交
3. `git stash` 临时搁置当前改动

每个 Task 独立提交，可单独回滚而不影响其他优化。
