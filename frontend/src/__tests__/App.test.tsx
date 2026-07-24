import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';
import { TestProviders } from '../test/setup';

vi.mock('../components/AgentStudio/AgentStudioWorkstation', () => ({
  default: () => <div data-testid="workstation">Workstation</div>,
}));

describe('App', { tags: ['unit'] }, () => {
  it('renders without crashing', async () => {
    render(
      <TestProviders>
        <App />
      </TestProviders>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId('workstation')).toBeTruthy();
    }, { timeout: 5000 });
  });
});
