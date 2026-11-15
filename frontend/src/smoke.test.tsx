import { describe, it, expect, beforeAll } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SolProvider } from './context/SolContext';
import { CosmosProvider } from './cosmos/CosmosContext';
import { CrewBoard } from './pages/CrewBoard';
import { CrewBoardPage } from './pages/CrewBoardPage';
import { AstronautDetail } from './pages/AstronautDetail';
import { AlertScreen } from './pages/AlertScreen';
import { DemoMode } from './pages/DemoMode';
import { DataMethod } from './pages/DataMethod';
import { BiomarkerRecovery } from './pages/BiomarkerRecovery';
import { DriverTimeline } from './pages/DriverTimeline';

// Mock minimal window/browser APIs for Node test environment
beforeAll(() => {
  if (typeof window === 'undefined') {
    const mockWindow = {
      location: { pathname: '/', search: '', hash: '', origin: 'http://localhost' },
      addEventListener: () => {},
      removeEventListener: () => {},
      matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
      devicePixelRatio: 1,
      requestAnimationFrame: () => 0,
      cancelAnimationFrame: () => {},
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
      },
    };
    (globalThis as unknown as { window: unknown }).window = mockWindow;
  }
  if (typeof document === 'undefined') {
    (globalThis as unknown as { document: unknown }).document = {
      createElement: () => ({
        getContext: () => null,
        getBoundingClientRect: () => ({ width: 1024, height: 768 }),
      }),
      getElementById: () => null,
    };
  }
  if (typeof ResizeObserver === 'undefined') {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

function renderRoute(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <SolProvider>
        <CosmosProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/" element={<CrewBoard />} />
              <Route path="/crew" element={<CrewBoardPage />} />
              <Route path="/crew/:id" element={<AstronautDetail />} />
              <Route path="/alert/:id" element={<AlertScreen />} />
              <Route path="/demo" element={<DemoMode />} />
              <Route path="/about" element={<DataMethod />} />
              <Route path="/recovery" element={<BiomarkerRecovery />} />
              <Route path="/drivers" element={<DriverTimeline />} />
            </Routes>
          </MemoryRouter>
        </CosmosProvider>
      </SolProvider>
    </QueryClientProvider>
  );
}

describe('Smoke Tests - Route Rendering', () => {
  const routes = [
    '/',
    '/crew',
    '/crew/C001',
    '/alert/C001',
    '/demo',
    '/about',
    '/recovery',
    '/drivers',
  ];

  routes.forEach((route) => {
    it(`renders route "${route}" with mocked API and asserts no throw`, () => {
      expect(() => {
        const html = renderRoute(route);
        expect(html).toBeTruthy();
      }).not.toThrow();
    });
  });
});
