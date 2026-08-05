# 思考面板 Markdown 渲染实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Agent 思考面板的推理节点改为渲染 Markdown，工具调用改为「类型徽章 + 等宽文本 + 默认折叠的可渲染结果」，后端零改动。

**Architecture:** 只改前端渲染层。`parseNode`/`groupThinkingNodes` 原样保留（切分与配对已正确）；新增共享 `markdownComponents(t)` 工厂供正文与思考卡复用，新增 `ThinkingMarkdown`（带裸 URL linkify）、`ReasoningCard`（推理/info 卡）、`ToolCallCard`（工具调用卡）。

**Tech Stack:** React 18, react-markdown ^9.1.0, Tailwind v4 (theme CSS vars), Vitest + Testing Library, TypeScript strict。

## Global Constraints

- 后端文件一律不动。
- 只允许修改：`frontend/src/components/AgentStudio/TeamMessage.tsx`、`frontend/src/styles/tailwind-entry.css`、`frontend/src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx`。
- `parseNode`、`groupThinkingNodes`、`ThinkingItem` 结构体禁止改动。
- 颜色一律用主题变量（`var(--color-*)`），禁止硬编码 hex 或 Tailwind 原生色板类。
- 徽章样式沿用既有模式：`bg-[var(--color-X)]/10 text-[var(--color-X)]`（参考 `ToolManagement.tsx:99`）。
- 命令均在 `frontend/` 目录运行。

---

### Task 1: 推理节点 Markdown 渲染（ReasoningCard）

把思考卡里的推理/info/裸段落从 `linkify(纯文本)` 换成 Markdown 渲染。抽取共享 `markdownComponents(t)` 工厂（正文与思考卡复用），新增 `ThinkingMarkdown`（复用 `linkify` 处理裸 URL，段落间距收紧为 `m-0`）。

**Files:**
- Modify: `frontend/src/components/AgentStudio/TeamMessage.tsx`（新增工厂 + ThinkingMarkdown；改 `ThinkingNodeItem` 推理/info 分支；内容 ReactMarkdown 改用工厂；给 `ThinkingNodeItem` 加 `t` prop 并在 3 处调用点传入）
- Test: `frontend/src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx`

**Interfaces:**
- Consumes: `parseNode`、`groupThinkingNodes`、`ThinkingItem`（现有，不动）；`linkify`、`CodeBlock`（现有，不动）；`useTranslation` 的 `t: TFunction`。
- Produces:
  - `function markdownComponents(t: (key: string) => string): Components` —— 返回 `ul/ol/li/p/code` 覆盖（`p` 为 `m-0 mb-3 last:mb-0`）。
  - `function ThinkingMarkdown({ t, children }: { t: (key: string) => string; children: string })` —— ReactMarkdown 包装，`p` 覆盖为 `m-0`，`text` 覆盖为 `linkify(String(children))`。
  - `ThinkingNodeItem` 新签名：`{ item: ThinkingItem; t: (key: string) => string }`。
  - Task 2 复用：`markdownComponents(t)`、`ThinkingMarkdown`、`t` prop 传递。

- [ ] **Step 1: 在测试文件补「推理 Markdown」用例（TDD）**

在 `frontend/src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx` 的 `describe('TeamMessage', ...)` 内追加：

```tsx
  describe('thinking markdown rendering', () => {
    it('renders bold and inline code in reasoning nodes without raw markers', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ thinking: 'The **readability** of `calc` is poor', thinkingDone: true })}
          allAgents={[mockAgent]}
        />
      );
      const strong = container.querySelector('strong');
      expect(strong).toBeTruthy();
      expect(strong?.textContent).toBe('readability');
      expect(container.querySelector('code')?.textContent).toBe('calc');
      expect(container.textContent).not.toContain('**');
    });

    it('renders bare URLs as links in reasoning nodes', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ thinking: 'See https://example.com for details', thinkingDone: true })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.querySelector('a[href="https://example.com"]')).toBeTruthy();
    });

    it('renders ordered/nested lists from markdown in reasoning nodes', () => {
      const { container } = render(
        <TeamMessage
          msg={makeMsg({ thinking: '1. **Readability**\n   - name is vague', thinkingDone: true })}
          allAgents={[mockAgent]}
        />
      );
      expect(container.querySelector('ol')).toBeTruthy();
      expect(container.querySelector('strong')?.textContent).toBe('Readability');
    });
  });
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx -t "thinking markdown"`
Expected: 「bold 和 inline code」与「列表」两用例 FAIL（现状无 `<strong>`/`<ol>`）；「裸 URL」用例 PASS（现状 `linkify` 已生成 `<a>`，作为特征回归守卫，不作红灯）。

- [ ] **Step 3: 实现**

修改 `frontend/src/components/AgentStudio/TeamMessage.tsx`：

3a. 顶部 import 加 `Components` 类型：

```tsx
import ReactMarkdown, { type Components } from 'react-markdown';
```

3b. 在 `linkify` 函数之后新增共享工厂与 `ThinkingMarkdown`：

```tsx
function markdownComponents(t: (key: string) => string): Components {
  return {
    ul({ children, ...props }) {
      return <ul className="my-2 pl-6 list-outside" {...props}>{children}</ul>;
    },
    ol({ children, ...props }) {
      return <ol className="my-2 pl-6 list-outside list-decimal" {...props}>{children}</ol>;
    },
    li({ children, ...props }) {
      return <li className="my-1 pl-1" {...props}>{children}</li>;
    },
    p({ children, ...props }) {
      return <p className="m-0 mb-3 last:mb-0" {...props}>{children}</p>;
    },
    code({ className, children }) {
      return <CodeBlock className={className} children={children} t={t} />;
    },
  };
}

function ThinkingMarkdown({ t, children }: { t: (key: string) => string; children: string }) {
  return (
    <ReactMarkdown
      components={{
        ...markdownComponents(t),
        p({ children }) {
          return <p className="m-0">{children}</p>;
        },
        text({ children }) {
          return <>{linkify(String(children))}</>;
        },
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
```

3c. 正文 ReactMarkdown 改用工厂（替换原有内联 components 对象）：

```tsx
              <ReactMarkdown components={markdownComponents(t)}>
                {msg.content}
              </ReactMarkdown>
```

3d. `ThinkingNodeItem` 加 `t` prop，推理/info/裸段落分支改为 `ThinkingMarkdown`：

```tsx
function ThinkingNodeItem({ item, t }: { item: ThinkingItem; t: (key: string) => string }) {
  const Dot = () => (
    <div className="absolute -left-3 top-[6px] w-2 h-2 rounded-full bg-[var(--color-text-muted)] border-2 border-[var(--color-surface)] z-[1]" />
  );

  if (item.type === 'toolPair') {
    return (
      <div className="relative mb-2.5 last:mb-0 pl-3">
        <Dot />
        <ToolCallBranch callText={item.callNode} resultText={item.resultNode} />
      </div>
    );
  }

  const parsed = item.parsed;
  const isInfo = parsed?.prefix === 'info';
  const displayText = parsed === null ? item.node.trim() : parsed.rest;
  return (
    <div className="relative mb-2.5 last:mb-0 leading-[1.65] pl-3">
      <Dot />
      <div className="text-[var(--color-text-muted)]">
        {isInfo && <span className="text-[var(--color-text-tertiary)]">[info] </span>}
        <ThinkingMarkdown t={t}>{displayText}</ThinkingMarkdown>
      </div>
    </div>
  );
}
```

3e. 三处调用点（`msg.thinkingDone` / `showContinue` / pending 三个分支）都传入 `t`：

```tsx
                              {items.map((item, i) => (
                                <ThinkingNodeItem key={i} item={item} t={t} />
                              ))}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx`
Expected: PASS（新增 3 个用例 + 既有 thinking 块用例）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentStudio/TeamMessage.tsx frontend/src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx
git commit -m "feat: render thinking reasoning nodes as markdown"
```

---

### Task 2: 工具调用卡（ToolCallCard）与收尾

把 `ToolCallBranch` 换成 `ToolCallCard`：类型色徽章（skill=accent 紫 / mcp=info 青 / tools=warning 琥珀）+ 等宽调用文本 + 默认折叠的结果（展开后渲染 Markdown）。新增 `--color-info` 主题色，删除 `ToolCallBranch`。

**Files:**
- Modify: `frontend/src/styles/tailwind-entry.css`（@theme 块加 `--color-info`）
- Modify: `frontend/src/components/AgentStudio/TeamMessage.tsx`（加 `TOOL_BADGE` + `ToolCallCard`，toolPair 分支替换，删 `ToolCallBranch`）
- Test: `frontend/src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx`

**Interfaces:**
- Consumes: `ThinkingItem['toolPair']`（`callParsed`/`resultParsed`，均为 `NonNullable<ParsedNode>`）、`ThinkingMarkdown`、`t`、`ChevronUp`/`ChevronDown`。
- Produces: `ToolCallCard({ callParsed, resultParsed, t })`。无外部消费者，Task 2 内闭环。

- [ ] **Step 1: 加 `--color-info` 主题色**

在 `frontend/src/styles/tailwind-entry.css` 的 `@theme` 块中，`--color-warning: #f59e0b;`（第 33 行）后加一行：

```css
  --color-info: #22d3ee;
```

- [ ] **Step 2: 在测试文件补「工具调用卡」用例（TDD）**

在 `describe('TeamMessage', ...)` 内追加：

```tsx
  describe('tool call cards', () => {
    const toolThinking = '[skill] skill_code_review({})[result] skill_code_review → 输出约束：**markdown**';

    it('renders badge and monospace call text', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ thinking: toolThinking, thinkingDone: true })} allAgents={[mockAgent]} />
      );
      expect(container.textContent).toContain('skill');
      expect(container.textContent).toContain('skill_code_review({})');
    });

    it('collapses result by default', () => {
      const { container } = render(
        <TeamMessage msg={makeMsg({ thinking: toolThinking, thinkingDone: true })} allAgents={[mockAgent]} />
      );
      expect(container.textContent).not.toContain('输出约束');
    });

    it('expands result on click and renders markdown', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <TeamMessage msg={makeMsg({ thinking: toolThinking, thinkingDone: true })} allAgents={[mockAgent]} />
      );
      await user.click(screen.getByText('skill_code_review({})'));
      expect(container.textContent).toContain('输出约束');
      expect(container.querySelector('strong')?.textContent).toBe('markdown');
    });
  });
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vitest run src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx -t "tool call cards"`
Expected: 「展开并渲染 Markdown」用例 FAIL（现状 `ToolCallBranch` 展开后是纯文本，无 `<strong>`，驱动本任务的改动）；「徽章」与「默认折叠」两用例 PASS（现状已折叠、文本含 skill，作为回归守卫）。

- [ ] **Step 4: 实现**

4a. 在 `ToolCallBranch` 的位置替换为徽章映射与 `ToolCallCard`（删除整个 `ToolCallBranch` 函数，88-122 行）：

```tsx
const TOOL_BADGE: Record<string, { label: string; className: string }> = {
  skill: { label: 'skill', className: 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]' },
  mcp: { label: 'mcp', className: 'bg-[var(--color-info)]/10 text-[var(--color-info)]' },
  tools: { label: 'tools', className: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]' },
};

function ToolCallCard({
  callParsed,
  resultParsed,
  t,
}: {
  callParsed: NonNullable<ParsedNode>;
  resultParsed: NonNullable<ParsedNode>;
  t: (key: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const badge = TOOL_BADGE[callParsed.prefix] || TOOL_BADGE.tools;
  const resultDisplay = resultParsed.rest.replace(/^\w+\s*(?:→|返回:)\s*/, '');

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1.5 cursor-pointer select-none rounded-sm py-0.5 hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <span className={`inline-flex items-center py-0.5 px-2 rounded-full text-[10px] font-medium leading-none ${badge.className}`}>{badge.label}</span>
        <code className="text-[0.85em] font-[var(--font-mono)] text-[var(--color-text-secondary)] break-all">{linkify(callParsed.rest)}</code>
        <span className="text-[var(--color-text-tertiary)]">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </div>

      {expanded && (
        <div className="mt-1 flex gap-1.5 text-sm leading-[1.65] text-[var(--color-text-muted)]">
          <span className="flex-none select-none text-[var(--color-text-tertiary)]">⟶</span>
          <div className="flex-1 min-w-0">
            <ThinkingMarkdown t={t}>{resultDisplay}</ThinkingMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
```

4b. `ThinkingNodeItem` 的 toolPair 分支换成 `ToolCallCard`：

```tsx
  if (item.type === 'toolPair') {
    return (
      <div className="relative mb-2.5 last:mb-0 pl-3">
        <Dot />
        <ToolCallCard callParsed={item.callParsed} resultParsed={item.resultParsed} t={t} />
      </div>
    );
  }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx`
Expected: PASS（新增 3 个用例 + Task 1 用例 + 既有用例）。

- [ ] **Step 6: 全量回归 + 类型检查**

Run:
```bash
npx vitest run src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx src/components/AgentStudio/__tests__/TeamMessage.actions.test.tsx src/components/AgentStudio/__tests__/MessagesPanel.test.tsx
npm run typecheck
```
Expected: 全部 PASS，typecheck 无错误。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/AgentStudio/TeamMessage.tsx frontend/src/components/AgentStudio/__tests__/TeamMessage.render.test.tsx frontend/src/styles/tailwind-entry.css
git commit -m "feat: tool call cards with type badge and collapsible markdown result"
```

---

## Self-Review

- **Spec coverage:** 设计文档「组件架构」的 ReasoningCard（Task 1）、ToolCallCard（Task 2）；「渲染层」Markdown 复用 `markdownComponents`（Task 1）；裸 URL 经 `text` 组件复用 `linkify`（Task 1）；结果默认折叠 + 点击展开（Task 2）；`--color-info` 青色徽章（Task 2）。测试节三项（推理 Markdown、类型徽章、折叠展开）均有对应用例。范围外项（摘要、紧凑时间线、后端改造）未实现，符合 YAGNI。
- **Placeholder scan:** 无 TBD/TODO/「相似于 Task N」引用；每个代码步骤都有完整代码块。
- **Type consistency:** `ThinkingMarkdown` 的 `t` 签名 `(key: string) => string` 两任务一致；`ThinkingNodeItem` 与 `ToolCallCard` 的 `t` prop 同签名；`markdownComponents` 返回 `Components`（react-markdown v9 导出）与既有内联使用兼容；`ToolCallCard` 参数 `NonNullable<ParsedNode>` 与 `ThinkingItem['toolPair']` 的字段一致（`callParsed`/`resultParsed`）。
