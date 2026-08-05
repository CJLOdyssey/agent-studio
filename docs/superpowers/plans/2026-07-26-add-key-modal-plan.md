# ProviderEditModal 分区重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor ProviderEditModal from a 234-line monolithic component into a zone-layout with four focused sub-components, while adding "set as default key" toggle, manual model editing, and inline connection test.

**Architecture:** ProviderEditModal becomes a thin state-owning shell that delegates to ProviderSelector (vendor selection + usage type), CredentialsSection (name/baseUrl/apiKey + default toggle), ModelSection (model list with manual add + API fetch), and ConnectionTest (inline test results). All state lives in ProviderEditModal; sub-components are pure presentational via props.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS v4 (CSS variables design tokens)

**Spec:** `docs/superpowers/specs/2026-07-26-add-key-modal-design.md`

---

### Task 1: Create ProviderSelector component

**Files:**
- Create: `frontend/src/components/AgentStudio/modals/ProviderSelector.tsx`
- Test: `frontend/src/components/AgentStudio/modals/__tests__/ProviderSelector.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';
import ProviderSelector from '../ProviderSelector';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'providerEdit.provider': '供应商',
          'workstation.capabilities': '支持能力',
          'workstation.purpose': '用途',
          'workstation.bothSupported': '两者都支持',
        };
        return map[key] || key;
      },
    }),
  };
});

const defaultProviders = {
  openai: { name: 'OpenAI', base_url: 'https://api.openai.com/v1', capabilities: ['llm', 'embedding'], docs_url: null },
  custom: { name: '自定义', base_url: '', capabilities: ['llm', 'embedding'], docs_url: null },
  deepseek: { name: 'DeepSeek', base_url: 'https://api.deepseek.com', capabilities: ['llm'], docs_url: null },
};

describe('ProviderSelector', () => {
  const baseProps = {
    providers: defaultProviders,
    providerType: 'openai',
    usageType: 'llm' as const,
    onChangeProvider: vi.fn(),
    onChangeUsage: vi.fn(),
  };

  it('renders provider selector dropdown', () => {
    render(<TestProviders><ProviderSelector {...baseProps} /></TestProviders>);
    expect(screen.getByDisplayValue('OpenAI')).toBeInTheDocument();
  });

  it('shows capability badges for current provider', () => {
    render(<TestProviders><ProviderSelector {...baseProps} /></TestProviders>);
    expect(screen.getByText('LLM')).toBeInTheDocument();
    expect(screen.getByText('Embed')).toBeInTheDocument();
  });

  it('only shows LLM badge for llm-only provider', () => {
    render(<TestProviders><ProviderSelector {...baseProps} providerType="deepseek" /></TestProviders>);
    expect(screen.getByText('LLM')).toBeInTheDocument();
    expect(screen.queryByText('Embed')).not.toBeInTheDocument();
  });

  it('calls onChangeProvider when selecting different provider', () => {
    const onChangeProvider = vi.fn();
    render(<TestProviders><ProviderSelector {...baseProps} onChangeProvider={onChangeProvider} /></TestProviders>);
    fireEvent.change(screen.getByDisplayValue('OpenAI'), { target: { value: 'deepseek' } });
    expect(onChangeProvider).toHaveBeenCalledWith('deepseek');
  });

  it('shows usage type radio buttons when multiple capabilities', () => {
    render(<TestProviders><ProviderSelector {...baseProps} /></TestProviders>);
    expect(screen.getByLabelText('LLM')).toBeInTheDocument();
    expect(screen.getByLabelText('Embed')).toBeInTheDocument();
    expect(screen.getByLabelText('两者都支持')).toBeInTheDocument();
  });

  it('hides usage radio for single-capability provider', () => {
    render(<TestProviders><ProviderSelector {...baseProps} providerType="deepseek" /></TestProviders>);
    expect(screen.getByText('LLM')).toBeInTheDocument();
    expect(screen.queryByLabelText('两者都支持')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/__tests__/ProviderSelector.test.tsx`
Expected: FAIL — "Cannot find module '../ProviderSelector'"

- [ ] **Step 3: Write minimal ProviderSelector implementation**

```tsx
import { useTranslation } from 'react-i18next';
import type { ProvidersMap } from '../../../api/client/providers';

const CAP_LABEL: Record<string, string> = { llm: 'LLM', embedding: 'Embed' };

interface Props {
  providers: ProvidersMap;
  providerType: string;
  usageType: string;
  onChangeProvider: (v: string) => void;
  onChangeUsage: (v: string) => void;
}

export default function ProviderSelector({
  providers, providerType, usageType,
  onChangeProvider, onChangeUsage,
}: Props) {
  const { t } = useTranslation();
  const caps = providers[providerType]?.capabilities ?? ['llm'];
  const multipleCaps = caps.length > 1;

  return (
    <div className="flex gap-4">
      <div className="flex-[2]">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('providerEdit.provider')}</label>
        <select
          value={providerType}
          onChange={(e) => onChangeProvider(e.target.value)}
          className="w-full py-2 pr-7 pl-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none cursor-pointer transition-colors appearance-none focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)]"
        >
          {Object.entries(providers).map(([key, info]) => (
            <option key={key} value={key}>{info.name}</option>
          ))}
        </select>
      </div>
      <div className="flex-[1]">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('workstation.capabilities')}</label>
        <div className="flex gap-2 mt-1">
          {caps.map((cap) => (
            <span key={cap} className="inline-flex items-center px-[10px] py-0.5 rounded text-xs font-semibold tracking-[0.3px] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
              {CAP_LABEL[cap] || cap}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/__tests__/ProviderSelector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/ProviderSelector.tsx frontend/src/components/AgentStudio/modals/__tests__/ProviderSelector.test.tsx
git commit -m "feat: create ProviderSelector sub-component for vendor selection"
```

---

### Task 2: Create CredentialsSection component

**Files:**
- Create: `frontend/src/components/AgentStudio/modals/CredentialsSection.tsx`
- Test: `frontend/src/components/AgentStudio/modals/__tests__/CredentialsSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';
import CredentialsSection from '../CredentialsSection';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'providerEdit.name': '备注名',
          'providerEdit.nameOptional': '可选',
          'providerEdit.baseUrl': 'Base URL',
          'providerEdit.apiKey': 'API Key',
          'providerEdit.nameHint': '用于区分不同的 Key，不填则使用供应商名称',
        };
        return map[key] || key;
      },
    }),
  };
});

describe('CredentialsSection', () => {
  const baseProps = {
    name: '',
    baseUrl: '',
    apiKey: '',
    isDefault: false,
    showKey: false,
    onChangeName: vi.fn(),
    onChangeBaseUrl: vi.fn(),
    onChangeApiKey: vi.fn(),
    onChangeIsDefault: vi.fn(),
    onToggleShowKey: vi.fn(),
  };

  it('renders all credential fields', () => {
    render(<TestProviders><CredentialsSection {...baseProps} /></TestProviders>);
    expect(screen.getByText('备注名')).toBeInTheDocument();
    expect(screen.getByText('Base URL')).toBeInTheDocument();
    expect(screen.getByText('API Key')).toBeInTheDocument();
  });

  it('renders default key checkbox', () => {
    render(<TestProviders><CredentialsSection {...baseProps} /></TestProviders>);
    expect(screen.getByLabelText('设为默认 Key')).toBeInTheDocument();
  });

  it('calls onChangeDefault when checkbox clicked', () => {
    const onChangeIsDefault = vi.fn();
    render(<TestProviders><CredentialsSection {...baseProps} onChangeIsDefault={onChangeIsDefault} /></TestProviders>);
    fireEvent.click(screen.getByLabelText('设为默认 Key'));
    expect(onChangeIsDefault).toHaveBeenCalledWith(true);
  });

  it('password field is type password by default', () => {
    render(<TestProviders><CredentialsSection {...baseProps} /></TestProviders>);
    const input = screen.getByPlaceholderText('sk-...') as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('shows key when showKey is true', () => {
    render(<TestProviders><CredentialsSection {...baseProps} showKey={true} /></TestProviders>);
    const input = screen.getByPlaceholderText('sk-...') as HTMLInputElement;
    expect(input.type).toBe('text');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/__tests__/CredentialsSection.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Tag } from 'lucide-react';

interface Props {
  name: string;
  baseUrl: string;
  apiKey: string;
  isDefault: boolean;
  showKey: boolean;
  onChangeName: (v: string) => void;
  onChangeBaseUrl: (v: string) => void;
  onChangeApiKey: (v: string) => void;
  onChangeIsDefault: (v: boolean) => void;
  onToggleShowKey: () => void;
}

export default function CredentialsSection({
  name, baseUrl, apiKey, isDefault, showKey,
  onChangeName, onChangeBaseUrl, onChangeApiKey,
  onChangeIsDefault, onToggleShowKey,
}: Props) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">
          {t('providerEdit.name')}
          <span className="font-normal text-[var(--color-text-muted)] text-[11px] ml-1">
            ({t('providerEdit.nameOptional') || 'optional'})
          </span>
        </label>
        <input type="text" value={name} onChange={(e) => onChangeName(e.target.value)}
          placeholder={t('providerEdit.name')}
          className="w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" />
        <p className="text-xs text-[var(--color-text-muted)] mt-1 flex items-center gap-1">
          <Tag size={11} className="shrink-0" /> {t('providerEdit.nameHint')}
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('providerEdit.baseUrl')}</label>
        <input type="text" value={baseUrl} onChange={(e) => onChangeBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="w-full py-2 px-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm font-sans outline-none transition-colors focus:border-[var(--color-accent)] focus:shadow-[0 0 0 2px var(--color-accent)] placeholder:text-[var(--color-text-muted)]" />
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('providerEdit.apiKey')}</label>
        <div className="flex items-center bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md overflow-hidden transition-colors focus-within:border-[var(--color-accent)] focus-within:shadow-[0 0 0 2px var(--color-accent)]">
          <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={(e) => onChangeApiKey(e.target.value)}
            placeholder="sk-..."
            className="flex-1 bg-transparent border-none px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:outline-none placeholder:text-[var(--color-text-muted)]" />
          <button type="button" className="p-2 bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer flex items-center justify-center hover:text-[var(--color-text-primary)]"
            onClick={onToggleShowKey} aria-label={showKey ? 'Hide API key' : 'Show API key'}>
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text-primary)] mb-4">
        <input type="checkbox" checked={isDefault} onChange={(e) => onChangeIsDefault(e.target.checked)}
          className="[accent-color:var(--color-accent)]" />
        <span>设为默认 Key</span>
        <span className="text-[11px] text-[var(--color-text-muted)]">当调用未指定 Key 时使用此 Key</span>
      </label>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/__tests__/CredentialsSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/CredentialsSection.tsx frontend/src/components/AgentStudio/modals/__tests__/CredentialsSection.test.tsx
git commit -m "feat: create CredentialsSection with default key toggle"
```

---

### Task 3: Create ConnectionTest component

**Files:**
- Create: `frontend/src/components/AgentStudio/modals/ConnectionTest.tsx`
- Test: `frontend/src/components/AgentStudio/modals/__tests__/ConnectionTest.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';
import ConnectionTest from '../ConnectionTest';

describe('ConnectionTest', () => {
  const baseProps = {
    onTest: vi.fn(),
    disabled: false,
    testing: false,
    testResult: null as { success: boolean; message: string; latency?: number } | null,
  };

  it('renders test button when not tested', () => {
    render(<TestProviders><ConnectionTest {...baseProps} /></TestProviders>);
    expect(screen.getByText('测试连接')).toBeInTheDocument();
  });

  it('shows spinner during testing', () => {
    render(<TestProviders><ConnectionTest {...baseProps} testing={true} /></TestProviders>);
    expect(screen.getByText('测试中...')).toBeInTheDocument();
  });

  it('shows success result', () => {
    render(<TestProviders><ConnectionTest {...baseProps} testResult={{ success: true, message: '连接成功', latency: 120 }} /></TestProviders>);
    expect(screen.getByText('✅ 连接成功')).toBeInTheDocument();
    expect(screen.getByText('120ms')).toBeInTheDocument();
  });

  it('shows failure result', () => {
    render(<TestProviders><ConnectionTest {...baseProps} testResult={{ success: false, message: 'Invalid API key', latency: 0 }} /></TestProviders>);
    expect(screen.getByText('❌ Invalid API key')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is true', () => {
    render(<TestProviders><ConnectionTest {...baseProps} disabled={true} /></TestProviders>);
    expect(screen.getByText('测试连接').closest('button')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/__tests__/ConnectionTest.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
import { Loader2 } from 'lucide-react';

export interface TestResult {
  success: boolean;
  message: string;
  latency?: number;
}

interface Props {
  onTest: () => void;
  disabled: boolean;
  testing: boolean;
  testResult: TestResult | null;
}

export default function ConnectionTest({ onTest, disabled, testing, testResult }: Props) {
  return (
    <div>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={onTest}
        disabled={disabled || testing}
      >
        {testing ? <Loader2 size={14} className="animate-spin" /> : null}
        {testing ? '测试中...' : '测试连接'}
      </button>

      {testResult && (
        <div className={`mt-3 px-3 py-2 rounded-md text-sm border ${
          testResult.success
            ? 'bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] border-[color-mix(in_srgb,var(--color-success)_25%,transparent)] text-[var(--color-success)]'
            : 'bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] border-[color-mix(in_srgb,var(--color-danger)_25%,transparent)] text-[var(--color-danger)]'
        }`}>
          {testResult.success ? '✅ 连接成功' : '❌ ' + testResult.message}
          {testResult.latency ? <span className="ml-2 opacity-70">{testResult.latency}ms</span> : null}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/__tests__/ConnectionTest.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/ConnectionTest.tsx frontend/src/components/AgentStudio/modals/__tests__/ConnectionTest.test.tsx
git commit -m "feat: create ConnectionTest component with inline results"
```

---

### Task 4: Create ModelSection component

**Files:**
- Create: `frontend/src/components/AgentStudio/modals/ModelSection.tsx`
- Test: `frontend/src/components/AgentStudio/modals/__tests__/ModelSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';
import ModelSection from '../ModelSection';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'providerEdit.supportedModels': '模型列表',
          'workstation.fetchingModels': '获取中...',
          'workstation.enterApiKeyToFetch': '填写 API Key 后点击刷新获取模型',
          'workstation.fetchFromApi': '从 API 获取',
        };
        return map[key] || key;
      },
    }),
  };
});

describe('ModelSection', () => {
  const baseProps = {
    models: ['gpt-4', 'gpt-3.5-turbo'],
    fetching: false,
    apiKey: 'sk-test',
    onAddModel: vi.fn(),
    onRemoveModel: vi.fn(),
    onFetchModels: vi.fn(),
  };

  it('renders model tags', () => {
    render(<TestProviders><ModelSection {...baseProps} /></TestProviders>);
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
    expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument();
  });

  it('shows empty state when no models and no apiKey', () => {
    render(<TestProviders><ModelSection {...baseProps} models={[]} apiKey="" /></TestProviders>);
    expect(screen.getByText('填写 API Key 后点击刷新获取模型')).toBeInTheDocument();
  });

  it('shows fetch button', () => {
    render(<TestProviders><ModelSection {...baseProps} /></TestProviders>);
    expect(screen.getByTitle('从 API 获取')).toBeInTheDocument();
  });

  it('calls onRemoveModel when tag X is clicked', () => {
    const onRemoveModel = vi.fn();
    render(<TestProviders><ModelSection {...baseProps} onRemoveModel={onRemoveModel} /></TestProviders>);
    const removeBtns = screen.getAllByRole('button', { hidden: true });
    // Find the X button on the first tag
    const tag = screen.getByText('gpt-4').closest('span');
    const xBtn = tag?.querySelector('button');
    if (xBtn) fireEvent.click(xBtn);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/__tests__/ModelSection.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw, Plus, X } from 'lucide-react';

interface Props {
  models: string[];
  fetching: boolean;
  apiKey: string;
  onAddModel: (model: string) => void;
  onRemoveModel: (model: string) => void;
  onFetchModels: () => void;
}

export default function ModelSection({
  models, fetching, apiKey,
  onAddModel, onRemoveModel, onFetchModels,
}: Props) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [newModel, setNewModel] = useState('');

  const handleAdd = () => {
    const trimmed = newModel.trim();
    if (trimmed && !models.includes(trimmed)) {
      onAddModel(trimmed);
    }
    setNewModel('');
    setAdding(false);
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('providerEdit.supportedModels')}</label>
      <div className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          {models.length > 0 ? (
            <div className="flex-1 flex flex-wrap gap-2 p-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md min-h-[36px]">
              {models.map((model) => (
                <span key={model} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--color-accent)] text-white rounded text-xs font-medium group">
                  {model}
                  <button type="button" onClick={() => onRemoveModel(model)}
                    className="p-0 bg-transparent border-none text-white/60 cursor-pointer hover:text-white transition-colors">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center p-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md text-[var(--color-text-muted)] text-sm">
              <span>{apiKey ? '暂无模型，点击刷新或手动添加' : t('workstation.enterApiKeyToFetch')}</span>
            </div>
          )}
          <button type="button" onClick={onFetchModels}
            disabled={!apiKey.trim() || fetching}
            title={t('workstation.fetchFromApi')}
            className="inline-flex items-center justify-center gap-2 px-2 py-1 rounded-md text-xs font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] disabled:opacity-40 disabled:cursor-not-allowed">
            {fetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {adding ? (
            <div className="flex items-center gap-1">
              <input type="text" value={newModel} onChange={(e) => setNewModel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="输入模型 ID"
                autoFocus
                className="w-40 py-1 px-2 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]" />
              <button type="button" onClick={handleAdd}
                className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent)] text-white border-none cursor-pointer">添加</button>
              <button type="button" onClick={() => { setAdding(false); setNewModel(''); }}
                className="px-2 py-1 rounded text-xs text-[var(--color-text-muted)] bg-transparent border-none cursor-pointer">取消</button>
            </div>
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-pointer border-none bg-transparent text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] transition-colors">
              <Plus size={12} /> 手动添加
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/__tests__/ModelSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/ModelSection.tsx frontend/src/components/AgentStudio/modals/__tests__/ModelSection.test.tsx
git commit -m "feat: create ModelSection with manual add and API fetch"
```

---

### Task 5: Refactor ProviderEditModal to use sub-components

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/ProviderEditModal.tsx`
- Modify: `frontend/src/components/AgentStudio/modals/__tests__/ProviderEditModal.test.tsx`

- [ ] **Step 1: Update ProviderEditModal to delegate to sub-components**

Replace the entire file with a slimmed-down version that owns the state and delegates rendering:

```tsx
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Tag, Loader2, Save } from 'lucide-react';

import { fetchModelsFromProvider } from '../../../api/client/keys';
import { listProviders } from '../../../api/client/providers';
import type { ProvidersMap } from '../../../api/client/providers';
import ProviderSelector from './ProviderSelector';
import CredentialsSection from './CredentialsSection';
import ModelSection from './ModelSection';
import ConnectionTest from './ConnectionTest';
import type { TestResult } from './ConnectionTest';

export interface ApiProviderForm {
  id: string;
  provider: string;
  usage_type: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: string[];
  isActive: boolean;
  status?: 'connected' | 'error' | 'untested';
}

const FALLBACK_PROVIDERS: ProvidersMap = {
  openai:    { name: 'OpenAI',       base_url: 'https://api.openai.com/v1',                          capabilities: ['llm', 'embedding'], docs_url: null },
  deepseek:  { name: 'DeepSeek',     base_url: 'https://api.deepseek.com',                           capabilities: ['llm'],              docs_url: null },
  anthropic: { name: 'Anthropic',    base_url: 'https://api.anthropic.com',                          capabilities: ['llm'],              docs_url: null },
  dashscope: { name: 'DashScope',    base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1',  capabilities: ['llm', 'embedding'], docs_url: null },
  custom:    { name: '自定义',       base_url: '',                                                    capabilities: ['llm', 'embedding'], docs_url: null },
};

interface Props {
  provider: ApiProviderForm;
  onSave: (provider: ApiProviderForm) => void;
  onClose: () => void;
  saving?: boolean;
}

export default function ProviderEditModal({ provider, onSave, onClose, saving = false }: Props) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  const [providers, setProviders] = useState<ProvidersMap>(FALLBACK_PROVIDERS);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerType, setProviderType] = useState(provider.provider || 'custom');
  const [usageType, setUsageType] = useState(provider.usage_type || 'llm');
  const [name, setName] = useState(provider.name);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl);
  const [apiKey, setApiKey] = useState(provider.apiKey);
  const [models, setModels] = useState<string[]>(provider.models);
  const [isDefault, setIsDefault] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    listProviders()
      .then(setProviders)
      .catch(() => {})
      .finally(() => setLoadingProviders(false));
  }, []);

  useEffect(() => {
    const info = providers[providerType];
    if (!info || !info.base_url) return;
    const knownDefaults = Object.values(providers).map((p) => p.base_url).filter(Boolean);
    const nextBaseUrl = (!baseUrl || knownDefaults.includes(baseUrl)) ? info.base_url : baseUrl;
    let nextUsage = usageType;
    if (usageType === 'both' && !info.capabilities.includes('embedding')) nextUsage = 'llm';
    if (usageType === 'embedding' && !info.capabilities.includes('embedding')) nextUsage = 'llm';
    const patch: Record<string, string> = {};
    if (nextBaseUrl !== baseUrl) patch.baseUrl = nextBaseUrl;
    if (nextUsage !== usageType) patch.usageType = nextUsage;
    if (Object.keys(patch).length) requestAnimationFrame(() => {
      if (patch.baseUrl) setBaseUrl(patch.baseUrl);
      if (patch.usageType) setUsageType(patch.usageType as 'llm' | 'embedding' | 'both');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerType]);

  const caps = providers[providerType]?.capabilities ?? ['llm'];
  const showModels = usageType === 'llm' || usageType === 'both';

  const handleSave = () => {
    onSave({
      ...provider, provider: providerType, usage_type: usageType,
      name, baseUrl, apiKey, models,
    });
  };

  const handleFetchModels = async () => {
    if (!apiKey.trim()) return;
    setFetchingModels(true);
    try {
      const result = await fetchModelsFromProvider({
        api_key: apiKey, base_url: baseUrl || undefined, provider: providerType,
      });
      if (result.success && result.models.length > 0) {
        setModels((prev) => {
          const merged = new Set([...prev, ...result.models]);
          return Array.from(merged);
        });
      }
    } catch { /* ignore */ }
    finally { setFetchingModels(false); }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) return;
    setTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const result = await fetchModelsFromProvider({
        api_key: apiKey, base_url: baseUrl || undefined, provider: providerType,
      });
      const latency = Math.round(performance.now() - start);
      setTestResult({
        success: result.success,
        message: result.success ? '连接成功' : (result.message || '未知错误'),
        latency,
      });
    } catch {
      setTestResult({ success: false, message: '连接超时或网络错误', latency: 0 });
    }
    setTesting(false);
  };

  return (
    <div className="fixed inset-0 bg-[var(--color-overlay)] flex items-center justify-center z-[var(--z-modal-backdrop)] backdrop-blur-[4px]" onClick={onClose}>
      <div className="bg-[var(--color-surface-raised)] rounded-xl w-[480px] max-h-[600px] flex flex-col [box-shadow:var(--shadow-lg)] z-[var(--z-modal)]" onClick={(e) => e.stopPropagation()} ref={contentRef} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-[38px] h-[38px] rounded-[10px] bg-[color-mix(in_srgb,var(--color-surface),var(--color-text-primary)_8%)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
              {loadingProviders ? <Loader2 size={16} className="animate-spin" /> : <Tag size={18} />}
            </div>
            <div>
              <h3 className="m-0">{provider.id ? t('providerEdit.edit') : t('providerEdit.add')}</h3>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)] leading-tight">
                {providers[providerType]?.base_url || ''}
              </p>
            </div>
          </div>
          <button type="button" className="bg-transparent border-none text-[var(--color-text-muted)] cursor-pointer p-1 flex items-center justify-center rounded-md transition-[background,color] duration-150 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose} aria-label={t('common.close')}><X size={18} /></button>
        </div>

        <div className="flex-1 px-6 py-5 overflow-y-auto">
          <div className="mb-5">
            <ProviderSelector
              providers={providers}
              providerType={providerType}
              usageType={usageType}
              onChangeProvider={setProviderType}
              onChangeUsage={setUsageType}
            />
          </div>

          <div className="mb-5">
            <CredentialsSection
              name={name} baseUrl={baseUrl} apiKey={apiKey}
              isDefault={isDefault} showKey={showKey}
              onChangeName={setName} onChangeBaseUrl={setBaseUrl}
              onChangeApiKey={setApiKey} onChangeIsDefault={setIsDefault}
              onToggleShowKey={() => setShowKey(!showKey)}
            />
          </div>

          {showModels && (
            <div className="mb-5">
              <ModelSection
                models={models} fetching={fetchingModels} apiKey={apiKey}
                onAddModel={(m) => setModels((prev) => [...prev, m])}
                onRemoveModel={(m) => setModels((prev) => prev.filter((x) => x !== m))}
                onFetchModels={handleFetchModels}
              />
            </div>
          )}

          <ConnectionTest
            onTest={handleTestConnection}
            disabled={!apiKey.trim() || testing}
            testing={testing}
            testResult={testResult}
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--color-border)]">
          <button type="button" className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]" onClick={onClose}>{t('confirm.cancel')}</button>
          <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-all duration-150 bg-[var(--color-accent)] text-white hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100" onClick={handleSave} disabled={!name.trim() || !apiKey.trim() || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? '...' : t('providerEdit.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update the test file to reflect the new structure**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'providerEdit.edit': 'Edit Provider',
          'providerEdit.add': 'Add Provider',
          'providerEdit.provider': '供应商',
          'providerEdit.name': '备注名',
          'providerEdit.nameOptional': 'optional',
          'providerEdit.baseUrl': 'Base URL',
          'providerEdit.apiKey': 'API Key',
          'providerEdit.supportedModels': '模型列表',
          'providerEdit.save': 'Save',
          'providerEdit.nameHint': 'Hint text',
          'workstation.capabilities': '支持能力',
          'workstation.purpose': '用途',
          'workstation.bothSupported': '两者都支持',
          'workstation.fetchingModels': 'Fetching...',
          'workstation.enterApiKeyToFetch': '填写 API Key 后点击刷新获取模型',
          'workstation.fetchFromApi': 'Fetch',
          'confirm.cancel': 'Cancel',
          'common.close': 'Close',
        };
        return map[key] || key;
      },
    }),
  };
});

const mockFetchModels = vi.fn();
vi.mock('../../../../api/client/keys', () => ({
  fetchModelsFromProvider: (...args: unknown[]) => mockFetchModels(...args),
}));

vi.mock('../../../../api/client/providers', () => ({
  listProviders: vi.fn().mockResolvedValue({
    openai: { name: 'OpenAI', base_url: 'https://api.openai.com/v1', capabilities: ['llm', 'embedding'], docs_url: null },
    custom: { name: 'Custom', base_url: '', capabilities: ['llm', 'embedding'], docs_url: null },
  }),
}));

import ProviderEditModal, { type ApiProviderForm } from '../ProviderEditModal';

const baseProvider: ApiProviderForm = {
  id: '', provider: 'openai', usage_type: 'llm',
  name: '', baseUrl: 'https://api.openai.com/v1',
  apiKey: '', models: [], isActive: true,
};

function renderModal(overrides: {
  provider?: ApiProviderForm; saving?: boolean;
  onSave?: ReturnType<typeof vi.fn>; onClose?: ReturnType<typeof vi.fn>;
} = {}) {
  return render(
    <TestProviders>
      <ProviderEditModal
        provider={overrides.provider || baseProvider}
        onSave={overrides.onSave || vi.fn()}
        onClose={overrides.onClose || vi.fn()}
        saving={overrides.saving}
      />
    </TestProviders>,
  );
}

describe('ProviderEditModal', { tags: ['integration'] }, () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders add title', async () => {
    renderModal();
    expect(await screen.findByText('Add Provider')).toBeInTheDocument();
  });

  it('renders edit title when provider has id', async () => {
    renderModal({ provider: { ...baseProvider, id: 'pk_1' } });
    expect(await screen.findByText('Edit Provider')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(await screen.findByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave with form data', async () => {
    const onSave = vi.fn();
    renderModal({ provider: { ...baseProvider, name: 'My Key', apiKey: 'sk-test123' }, onSave });
    fireEvent.click(await screen.findByText('Save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Key', apiKey: 'sk-test123' }),
    );
  });

  it('save button is disabled when apiKey empty', async () => {
    renderModal();
    const saveBtn = await screen.findByText('Save');
    expect(saveBtn.closest('button')).toBeDisabled();
  });

  it('fetches models when fetch button clicked', async () => {
    mockFetchModels.mockResolvedValue({ success: true, models: ['gpt-4', 'gpt-3.5-turbo'], message: '' });
    renderModal({ provider: { ...baseProvider, apiKey: 'sk-test' } });
    const fetchBtn = await screen.findByTitle('Fetch');
    fireEvent.click(fetchBtn);
    expect(mockFetchModels).toHaveBeenCalled();
  });

  it('shows loading when saving', async () => {
    renderModal({ saving: true });
    expect(await screen.findByText('...')).toBeInTheDocument();
  });

  it('stops propagation on modal content click', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const content = document.querySelector('[role="dialog"]')!;
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run all tests to verify**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/`
Expected: ALL PASS (including existing ApiManagementModal, ApiProviderTab, ModelSelector tests)

- [ ] **Step 4: Run TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/ProviderEditModal.tsx frontend/src/components/AgentStudio/modals/__tests__/ProviderEditModal.test.tsx
git commit -m "refactor: integrate sub-components into ProviderEditModal"
```

---

### Task 6: Add UsageType selector to ProviderSelector (purpose radio)

**Note:** The `ProviderSelector` created in Task 1 only has the dropdown and capability badges. The usage type radio buttons (Purpose section) need to be added within it, since they're part of the vendor selection zone per spec.

**Files:**
- Modify: `frontend/src/components/AgentStudio/modals/ProviderSelector.tsx`

- [ ] **Step 1: Add the Purpose radio section to ProviderSelector**

Insert after the flex row (dropdown + capabilities), before closing the component:

```tsx
<div className="mt-4">
  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">{t('workstation.purpose')}</label>
  {multipleCaps ? (
    <div className="flex gap-3">
      {caps.map((cap) => (
        <label key={cap} className="flex items-center gap-2 p-2 px-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md cursor-pointer text-sm text-[var(--color-text-primary)] transition-[border-color] duration-150 hover:border-[var(--color-accent)] [&>input]:[accent-color:var(--color-accent)]">
          <input type="radio" name="usage_type" checked={usageType === cap} onChange={() => onChangeUsage(cap)} />
          <span>{CAP_LABEL[cap] || cap}</span>
        </label>
      ))}
      {caps.includes('llm') && caps.includes('embedding') && (
        <label className="flex items-center gap-2 p-2 px-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-md cursor-pointer text-sm text-[var(--color-text-primary)] transition-[border-color] duration-150 hover:border-[var(--color-accent)] [&>input]:[accent-color:var(--color-accent)]">
          <input type="radio" name="usage_type" checked={usageType === 'both'} onChange={() => onChangeUsage('both')} />
          <span>{t('workstation.bothSupported')}</span>
        </label>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2 py-2 mt-1">
      {caps.map((cap) => (
        <span key={cap} className="inline-flex items-center px-[10px] py-0.5 rounded text-xs font-semibold tracking-[0.3px] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent)] border border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)]">
          {CAP_LABEL[cap] || cap}
        </span>
      ))}
      <span className="text-[11px] text-[var(--color-text-muted)] ml-2">
        {t('workstation.purpose')}: {CAP_LABEL[caps[0]] || caps[0]}
      </span>
    </div>
  )}
</div>
```

- [ ] **Step 2: Update the ProviderSelector test to cover purpose radios**

Add these test cases to `ProviderSelector.test.tsx`:

```tsx
it('calls onChangeUsage when radio clicked', () => {
  const onChangeUsage = vi.fn();
  render(<TestProviders><ProviderSelector {...baseProps} onChangeUsage={onChangeUsage} /></TestProviders>);
  fireEvent.click(screen.getByLabelText('Embed'));
  expect(onChangeUsage).toHaveBeenCalledWith('embedding');
});

it('shows both option when provider supports both', () => {
  render(<TestProviders><ProviderSelector {...baseProps} /></TestProviders>);
  expect(screen.getByLabelText('两者都支持')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run tests**

Run: `cd frontend && npx vitest run src/components/AgentStudio/modals/__tests__/ProviderSelector.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AgentStudio/modals/ProviderSelector.tsx frontend/src/components/AgentStudio/modals/__tests__/ProviderSelector.test.tsx
git commit -m "feat: add usage type radio to ProviderSelector"
```

---

### Plan Self-Review

**Spec coverage check:**
- ✅ ProviderSelector with dropdown + capability badges + usage radios → Task 1 + 6
- ✅ CredentialsSection with name/baseUrl/apiKey/default toggle → Task 2
- ✅ ModelSection with tag list, manual add, API fetch → Task 4
- ✅ ConnectionTest with inline results → Task 3
- ✅ ProviderEditModal integration → Task 5
- ✅ No backend changes (API compatible)

**Placeholder scan:** No TBDs, TODOs, or vague instructions. Every step contains complete code.

**Type consistency:** All prop types match across tasks. `ConnectionTest.TestResult` matches `fetchModelsFromProvider` response shape.
