import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'zh' } }),
}));
vi.mock('../../../api/client/instance', () => ({
  default: { post: vi.fn().mockResolvedValue({}) },
}));

import ApprovalModal from '../ApprovalModal';
import { useApprovalStore } from '../../../stores/streamHandler';
import api from '../../../api/client/instance';

afterEach(() => {
  useApprovalStore.getState().setRequest(null);
  vi.clearAllMocks();
});

describe('ApprovalModal', { tags: ['unit'] }, () => {
  const bodyText = () => document.body.textContent || '';

  it('opens modal when the approval store has a request', () => {
    useApprovalStore.getState().setRequest({ runId: 'run-1', node: 'reviewer' });
    render(<ApprovalModal />);
    expect(bodyText()).toContain('teamMessage.approvalRequired');
    expect(bodyText()).toContain('teamMessage.approvalNode');
  });

  it('stays closed without a request', () => {
    render(<ApprovalModal />);
    expect(bodyText()).not.toContain('teamMessage.approvalRequired');
  });

  it('submits approval via POST and closes the modal', async () => {
    vi.mocked(api.post).mockResolvedValue({} as never);
    useApprovalStore.getState().setRequest({ runId: 'run-1', node: 'reviewer' });
    render(<ApprovalModal />);
    fireEvent.click(document.querySelector('[data-testid="approve-btn"]') as HTMLElement);
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/team-runs/run-1/approve', { approved: true, reason: undefined });
    });
    expect(useApprovalStore.getState().request).toBeNull();
  });

  it('submits rejection with a note', async () => {
    vi.mocked(api.post).mockResolvedValue({} as never);
    useApprovalStore.getState().setRequest({ runId: 'run-1', node: 'reviewer' });
    render(<ApprovalModal />);
    const note = document.querySelector('[data-testid="approval-note"]') as HTMLTextAreaElement;
    fireEvent.change(note, { target: { value: 'needs rework' } });
    fireEvent.click(document.querySelector('[data-testid="reject-btn"]') as HTMLElement);
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/team-runs/run-1/approve', { approved: false, reason: 'needs rework' });
    });
  });
});
