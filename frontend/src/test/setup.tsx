import '@testing-library/jest-dom';
import * as axeMatchers from 'vitest-axe/matchers';
import { vi, expect } from 'vitest';

expect.extend(axeMatchers);

// 屏蔽无害异步副作用（useGenericCrud、usePickerState 等）产生的 act(...) 警告。
// 测试通过时这些警告只是噪音，无害。
const _origWarn = console.warn;
const _origErr = console.error;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return;
  _origWarn.call(console, ...args);
};
console.error = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return;
  _origErr.call(console, ...args);
};
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VirtuosoMockContext } from 'react-virtuoso';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ToastProvider } from '../utils/useToast';
import '../i18n/index';

vi.mock('../components/auth', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: null,
    loading: false,
    legacyMode: false,
    isAuthenticated: false,
    loginModalOpen: false,
    loginModalView: 'login' as const,
    login: vi.fn(),
    register: vi.fn(),
    verify: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    logout: vi.fn(),
    resendVerification: vi.fn(),
    sendRegisterCode: vi.fn(),
    openLoginModal: vi.fn(),
    closeLoginModal: vi.fn(),
    refetchUser: vi.fn(),
  }),
}));

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();
Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation((query: string) => ({ matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() })) });

// ECharts 需要 canvas mock
const mockCtx = {
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  getImageData: vi.fn(() => ({ data: [] })),
  putImageData: vi.fn(),
  createImageData: vi.fn(() => []),
  setTransform: vi.fn(),
  drawImage: vi.fn(),
  save: vi.fn(),
  fillText: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  stroke: vi.fn(),
  translate: vi.fn(),
  scale: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  transform: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  bezierCurveTo: vi.fn(),
  canvas: { width: 800, height: 600 },
};
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn(() => mockCtx),
  writable: true,
  configurable: true,
});

// react-virtuoso 需要 ResizeObserver 来测量容器尺寸
window.ResizeObserver = vi.fn(function ResizeObserver(callback: ResizeObserverCallback) {
  const targets = new WeakSet<Element>();
  return {
    observe(target: Element) {
      targets.add(target);
      Promise.resolve().then(() => {
        const width = parseFloat((target as HTMLElement).style.width) || 800;
        const height = parseFloat((target as HTMLElement).style.height) || 600;
        callback(
          [{ borderBoxSize: [{ blockSize: height, inlineSize: width }], contentBoxSize: [{ blockSize: height, inlineSize: width }], contentRect: new DOMRectReadOnly(0, 0, width, height), devicePixelContentBoxSize: [{ blockSize: height, inlineSize: width }], target }],
          this as unknown as ResizeObserver,
        );
      });
    },
    unobserve(target: Element) { targets.delete(target); },
    disconnect() {},
  } as unknown as ResizeObserver;
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <ToastProvider>
          <VirtuosoMockContext.Provider value={{ viewportHeight: 800, itemHeight: 60 }}>
            <MemoryRouter>
              <Routes>
                <Route path="/chat/:sessionId" element={children} />
                <Route path="*" element={children} />
              </Routes>
            </MemoryRouter>
          </VirtuosoMockContext.Provider>
        </ToastProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
