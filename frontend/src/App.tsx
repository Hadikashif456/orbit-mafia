import type { FC } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { DisclaimerBar } from './components/DisclaimerBar';
import { CrewBoard } from './pages/CrewBoard';
import { AstronautDetail } from './pages/AstronautDetail';
import { DemoMode } from './pages/DemoMode';
import { CosmosProvider } from './cosmos/CosmosContext';
import { CosmicBackdrop } from './cosmos/CosmicBackdrop';
import { CosmicSceneSwitcher } from './cosmos/CosmicSceneSwitcher';

export const App: FC = () => {
  return (
    <BrowserRouter>
      <CosmosProvider>
      {/* Animated ASCII universe behind every view; never takes pointer events */}
      <CosmicBackdrop />
      <div className="relative z-10 min-h-screen flex flex-col text-slate-100">
        {/* Mandatory safety disclaimer on every view */}
        <DisclaimerBar />

        {/* Navigation header */}
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="text-cyan-400">Vital</span>Orbit
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium">
                <Link to="/" className="text-slate-300 hover:text-white transition-colors">
                  Crew Board
                </Link>
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

        {/* Main page content */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<CrewBoard />} />
            <Route path="/crew/:id" element={<AstronautDetail />} />
            <Route path="/demo" element={<DemoMode />} />
            <Route path="/cosmos/*" element={<CosmicSceneSwitcher />} />
          </Routes>
        </main>
      </div>
      </CosmosProvider>
    </BrowserRouter>
  );
};

export default App;
