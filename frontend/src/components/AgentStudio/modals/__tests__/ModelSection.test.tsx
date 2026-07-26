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
          'providerEdit.supportedModels': '支持的模型',
          'providerEdit.noModelsWithKey': '暂无模型，点击刷新获取',
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

  it('shows noModelsWithKey text when models empty and apiKey present', () => {
    render(<TestProviders><ModelSection {...baseProps} models={[]} apiKey="sk-test" /></TestProviders>);
    expect(screen.getByText('暂无模型，点击刷新获取')).toBeInTheDocument();
  });

  it('calls onRemoveModel when tag X is clicked', () => {
    const onRemoveModel = vi.fn();
    render(<TestProviders><ModelSection {...baseProps} onRemoveModel={onRemoveModel} /></TestProviders>);
    const tag = screen.getByText('gpt-4').closest('span');
    const xBtn = tag?.querySelector('button');
    if (xBtn) fireEvent.click(xBtn);
    expect(onRemoveModel).toHaveBeenCalledWith('gpt-4');
  });
});
