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
    expect(screen.getAllByText('LLM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Embed').length).toBeGreaterThan(0);
  });

  it('only shows LLM badge for llm-only provider', () => {
    render(<TestProviders><ProviderSelector {...baseProps} providerType="deepseek" /></TestProviders>);
    expect(screen.getAllByText('LLM').length).toBeGreaterThan(0);
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
    expect(screen.getAllByText('LLM').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('两者都支持')).not.toBeInTheDocument();
  });
});
