/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import csp from 'vite-plugin-csp';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDev = mode === 'development';
  const apiOrigin = env.VITE_API_BASE_URL || 'http://localhost:8080';
  // Derive WS origin from API origin or use env override
  const wsOrigin = env.VITE_WS_URL || apiOrigin.replace(/^http/, 'ws');

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [
      tailwindcss(),
      react(),
      csp({
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", "'strict-dynamic'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", "data:", "https:"],
          'font-src': ["'self'", "data:", "https:"],
          'connect-src': [
            "'self'",
            apiOrigin,
            wsOrigin,
            ...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : []),
          ],
          'frame-src': ["'none'"],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
        },
        hashStyle: 'sha256',
        enabled: env.VITE_ENABLE_STRICT_CSP === 'true',
      }),
      visualizer({ open: false, filename: 'dist/stats.html', gzipSize: true }),
    ],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
        },
        '/ws': {
          target: wsOrigin,
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            utils: ['axios', 'zustand'],
            sentry: ['@sentry/react', '@sentry/browser'],
          },
        },
      },
      chunkSizeWarningLimit: 500,
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.tsx',
      css: true,
      testTimeout: 15000,
      hookTimeout: 15000,
      exclude: ['e2e/**', 'node_modules/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov', 'html'],
        reportsDirectory: './coverage',
        thresholds: {
          statements: 75,
          branches: 65,
          functions: 60,
          lines: 75,
        },
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/__tests__/**',
          'src/test/**',
          'src/types/**',
          'src/data/**',
          'src/constants/**',

          'src/components/auth/**',
          'src/**/tabConfig.tsx',
          'src/**/locales.ts',
          'src/main.tsx',
          'src/App.tsx',
          'src/**/index.ts',
          'src/api/websocket.ts',
          'src/api/hooks.ts',
          'src/api/client/instance.ts',
          'src/utils/logger.ts',
          'src/hooks/useTeamAgents.ts',
          'src/hooks/useTeamData.ts',
          'src/api/client/teams.ts',
          'src/api/client/tools.ts',
          'src/vite-env.d.ts',
          'src/vite-env.d.ts',
          'src/components/AgentStudio/workstation/output/useOutputUI.ts',
        ],
      },
    },
  };
});
