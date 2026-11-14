import type { FC } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink, useLocation } from 'react-router-dom';
import { DisclaimerBar } from './components/DisclaimerBar';
import { CrewBoard } from './pages/CrewBoard';
import { CrewBoardPage } from './pages/CrewBoardPage';
import { AstronautDetail } from './pages/AstronautDetail';
import { AlertScreen } from './pages/AlertScreen';
import { DemoMode } from './pages/DemoMode';
import { CosmosProvider } from './cosmos/CosmosContext';
import { CosmicBackdrop } from './cosmos/CosmicBackdrop';
import { CosmicSceneSwitcher } from './cosmos/CosmicSceneSwitcher';

const Shell: FC = () => {
  // The cosmos page is a full-bleed visual with no health data on it, so it
  // runs without the disclaimer bar and navigation header.
  const fullBleed = useLocation().pathname.startsWith('/cosmos');

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-slate-100">
      {!fullBleed && (
        <>
          {/* Mandatory safety disclaimer on every data view */}
          <DisclaimerBar />

          {/* Navigation header */}
          <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-6">
                <Link to="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span className="text-cyan-400">Vital</span>Orbit
                </Link>
                <nav className="flex items-center gap-4 text-sm font-medium">
                  <NavLink
                    to="/crew"
                    end
                    className={({ isActive }) =>
                      `${isActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`
                    }
                  >
                    Crew Board
                  </NavLink>
                  <Link to="/crew/C001" className="text-slate-300 hover:text-white transition-colors">
                    Astronaut Detail
                  </Link>
                  <Link to="/demo" className="text-slate-300 hover:text-white transition-colors">
                    Demo Mode
                  </Link>
                  <Link to="/cosmos" className="text-slate-300 hover:text-white transition-colors">
                    Cosmos
                  </Link>
                </nav>
              </div>
              <div className="hidden sm:block text-xs font-mono text-slate-400">
                MISSION SOL 144
              </div>
            </div>
          </header>
        </>
      )}

      {/* Main page content */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<CrewBoard />} />
          <Route path="/crew" element={<CrewBoardPage />} />
          <Route path="/crew/:id" element={<AstronautDetail />} />
          <Route path="/alert/:id" element={<AlertScreen />} />
          <Route path="/demo" element={<DemoMode />} />
          <Route path="/cosmos/*" element={<CosmicSceneSwitcher />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: FC = () => {
  return (
    <BrowserRouter>
      <CosmosProvider>
        {/* Animated ASCII universe behind every view; never takes pointer events */}
        <CosmicBackdrop />
        <Shell />
      </CosmosProvider>
    </BrowserRouter>
  );
};

export default App;