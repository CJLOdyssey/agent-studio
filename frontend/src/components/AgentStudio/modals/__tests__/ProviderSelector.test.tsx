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
          'providerEdit.category.llm': 'LLM',
          'providerEdit.category.embedding': '嵌入(Embedding)',
          'providerEdit.category.rerank': '重排序(Rerank)',
          'providerEdit.category.speech2text': '语音转文字',
          'providerEdit.category.tts': '文字转语音',
          'providerEdit.category.moderation': '内容审核(Moderation)',
          'providerEdit.category.tool': 'Tool',
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

  it('groups providers by capability into optgroups', () => {
    render(
      <TestProviders>
        <ProviderSelector
          {...baseProps}
          providers={{
            ...defaultProviders,
            tavily: { name: 'Tavily AI Search', base_url: '', capabilities: ['tool'], docs_url: null },
            stability: { name: 'Stability AI', base_url: 'https://api.stability.ai', capabilities: ['image'], docs_url: null },
            cohere: { name: 'Cohere', base_url: 'https://api.cohere.com', capabilities: ['rerank'], docs_url: null },
          }}
        />
      </TestProviders>,
    );
    const groups = screen.getAllByRole('group') as HTMLOptGroupElement[];
    expect(groups.map((g) => g.label)).toEqual([
      'LLM',
      '嵌入(Embedding)',
      '重排序(Rerank)',
      '语音转文字',
      '文字转语音',
      '内容审核(Moderation)',
      'Tool',
    ]);
    expect(screen.getAllByText('OpenAI')).toHaveLength(2);
    expect(screen.getAllByText('Tavily AI Search')).toHaveLength(1);
    expect(screen.getAllByText('Stability AI')).toHaveLength(1);
    expect(screen.getAllByText('自定义')).toHaveLength(7);
  });
});
