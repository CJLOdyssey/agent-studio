import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'api.defaultModel': 'Default Model',
        'api.selectModel': 'Select a model',
      };
      return map[key] || key;
    },
  }),
}));

import ModelSelector from '../ModelSelector';

describe('ModelSelector', { tags: ['integration'] }, () => {
  const models = [
    { model: 'gpt-4', keyId: 'key1' },
    { model: 'gpt-3.5', keyId: 'key2' },
  ];

  it('renders model list', () => {
    render(<ModelSelector models={models} selectedModel="gpt-4" onSelect={vi.fn()} />);
    expect(screen.getByText('Default Model')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
    expect(screen.getByText('gpt-3.5')).toBeInTheDocument();
  });

  it('renders empty state when no models', () => {
    render(<ModelSelector models={[]} selectedModel="" onSelect={vi.fn()} />);
    expect(screen.getByText('api.noKeys')).toBeInTheDocument();
  });

  it('highlights selected model', () => {
    render(<ModelSelector models={models} selectedModel="gpt-4" onSelect={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
  });

  it('groups models by type', () => {
    render(
      <ModelSelector
        models={[
          { model: 'gpt-4o', keyId: 'key1', type: 'llm' },
          { model: 'text-embedding-3-small', keyId: 'key1', type: 'embedding' },
        ]}
        selectedModel=""
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('providerEdit.category.llm')).toBeInTheDocument();
    expect(
      screen.getByText('providerEdit.category.embedding'),
    ).toBeInTheDocument();
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('text-embedding-3-small')).toBeInTheDocument();
  });

  it('shows empty-group hint for categories without models', () => {
    render(
      <ModelSelector
        models={[{ model: 'gpt-4o', keyId: 'key1', type: 'llm' }]}
        selectedModel=""
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    expect(screen.getAllByText('providerEdit.noModelsInGroup').length).toBe(6);
  });
});
