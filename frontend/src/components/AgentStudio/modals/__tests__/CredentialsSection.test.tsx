import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
    showKey: false,
    onChangeName: vi.fn(),
    onChangeBaseUrl: vi.fn(),
    onChangeApiKey: vi.fn(),
    onToggleShowKey: vi.fn(),
  };

  it('renders all credential fields', () => {
    render(<TestProviders><CredentialsSection {...baseProps} /></TestProviders>);
    expect(screen.getByText('备注名')).toBeInTheDocument();
    expect(screen.getByText('Base URL')).toBeInTheDocument();
    expect(screen.getByText('API Key')).toBeInTheDocument();
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
