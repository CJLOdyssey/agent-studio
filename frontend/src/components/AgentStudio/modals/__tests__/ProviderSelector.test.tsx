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
        };
        return map[key] || key;
      },
    }),
  };
});

const defaultProviders = {
  openai: { name: 'OpenAI', base_url: 'https://api.openai.com/v1', capabilities: ['chat', 'vector'], docs_url: null },
  custom: { name: '自定义', base_url: '', capabilities: ['chat', 'vector'], docs_url: null },
  deepseek: { name: 'DeepSeek', base_url: 'https://api.deepseek.com', capabilities: ['chat'], docs_url: null },
};

describe('ProviderSelector', () => {
  const baseProps = {
    providers: defaultProviders,
    providerType: 'openai',
    onChangeProvider: vi.fn(),
  };

  it('renders provider selector dropdown', () => {
    render(<TestProviders><ProviderSelector {...baseProps} /></TestProviders>);
    expect(screen.getByDisplayValue('OpenAI')).toBeInTheDocument();
  });

  it('calls onChangeProvider when selecting different provider', () => {
    const onChangeProvider = vi.fn();
    render(<TestProviders><ProviderSelector {...baseProps} onChangeProvider={onChangeProvider} /></TestProviders>);
    fireEvent.change(screen.getByDisplayValue('OpenAI'), { target: { value: 'deepseek' } });
    expect(onChangeProvider).toHaveBeenCalledWith('deepseek');
  });
});
