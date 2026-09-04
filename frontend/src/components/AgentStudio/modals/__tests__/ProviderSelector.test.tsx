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
          'providerEdit.category.embedding': '嵌入',
          'providerEdit.category.rerank': '重排序',
          'providerEdit.category.speech2text': '语音转文字',
          'providerEdit.category.tts': '文字转语音',
          'providerEdit.category.moderation': '内容审核',
          'providerEdit.category.image': '图像',
          'providerEdit.category.tool': '工具',
        };
        return map[key] || key;
      },
    }),
  };
});

const defaultProviders = {
  openai: { name: 'OpenAI', base_url: 'https://api.openai.com/v1', capabilities: ['chat', 'vector'], docs_url: null },
  deepseek: { name: 'DeepSeek', base_url: 'https://api.deepseek.com', capabilities: ['chat'], docs_url: null },
  custom_llm: { name: '自定义大模型', base_url: '', capabilities: ['chat'], docs_url: null },
  custom_embedding: { name: '自定义嵌入', base_url: '', capabilities: ['vector'], docs_url: null },
  custom_rerank: { name: '自定义重排序', base_url: '', capabilities: ['rerank'], docs_url: null },
  custom_speech2text: { name: '自定义语音转文字', base_url: '', capabilities: ['speech2text'], docs_url: null },
  custom_tts: { name: '自定义文字转语音', base_url: '', capabilities: ['tts'], docs_url: null },
  custom_moderation: { name: '自定义内容审核', base_url: '', capabilities: ['moderation'], docs_url: null },
  custom_image: { name: '自定义图像', base_url: '', capabilities: ['image'], docs_url: null },
  custom_tool: { name: '自定义工具', base_url: '', capabilities: ['tool'], docs_url: null },
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
      '嵌入',
      '重排序',
      '语音转文字',
      '文字转语音',
      '内容审核',
      '图像',
      '工具',
    ]);
    expect(screen.getAllByText('OpenAI')).toHaveLength(2);
    expect(screen.getAllByText('Tavily AI Search')).toHaveLength(1);
    expect(screen.getAllByText('Stability AI')).toHaveLength(1);
    expect(screen.getByText('自定义大模型')).toBeInTheDocument();
    expect(screen.getByText('自定义嵌入')).toBeInTheDocument();
    expect(screen.getByText('自定义重排序')).toBeInTheDocument();
    expect(screen.getByText('自定义语音转文字')).toBeInTheDocument();
    expect(screen.getByText('自定义文字转语音')).toBeInTheDocument();
    expect(screen.getByText('自定义内容审核')).toBeInTheDocument();
    expect(screen.getByText('自定义图像')).toBeInTheDocument();
    expect(screen.getByText('自定义工具')).toBeInTheDocument();
  });
});
