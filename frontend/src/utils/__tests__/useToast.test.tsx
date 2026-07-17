import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { TestProviders } from '../../../test/setup';
import { useToast, ToastProvider } from '../useToast';

describe('useToast', () => {
  it('exposes toast function', () => {
    const ToastConsumer = () => {
      const { toast } = useToast();
      return <button onClick={() => toast('Hello')}>Show</button>;
    };

    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByText('Show'));
    });

    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('accepts custom toast type', () => {
    const ToastConsumer = () => {
      const { toast } = useToast();
      return <button onClick={() => toast('Error!', 'error')}>Error</button>;
    };

    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByText('Error'));
    });

    expect(screen.getByText('Error!')).toBeTruthy();
  });

  it('removes toast on close button click', () => {
    const ToastConsumer = () => {
      const { toast } = useToast();
      return <button onClick={() => toast('Removable')}>Add</button>;
    };

    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByText('Add'));
    });

    expect(screen.getByText('Removable')).toBeTruthy();

    const closeButton = screen.getByLabelText('Close notification');
    act(() => {
      fireEvent.click(closeButton);
    });

    expect(screen.queryByText('Removable')).toBeNull();
  });

  it('renders multiple toasts', () => {
    const ToastConsumer = () => {
      const { toast } = useToast();
      return (
        <div>
          <button onClick={() => toast('First')}>Add First</button>
          <button onClick={() => toast('Second', 'success')}>Add Second</button>
        </div>
      );
    };

    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByText('Add First'));
    });

    act(() => {
      fireEvent.click(screen.getByText('Add Second'));
    });

    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
  });
});
