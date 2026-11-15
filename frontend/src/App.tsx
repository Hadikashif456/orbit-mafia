import { useState, useEffect, type FC } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { DisclaimerBar } from './components/DisclaimerBar';
import { CrewBoard } from './pages/CrewBoard';
import { CrewBoardPage } from './pages/CrewBoardPage';
import { AstronautDetail } from './pages/AstronautDetail';
import { AlertScreen } from './pages/AlertScreen';
import { DemoMode } from './pages/DemoMode';
import { DataMethod } from './pages/DataMethod';
import { BiomarkerRecovery } from './pages/BiomarkerRecovery';
import { DriverTimeline } from './pages/DriverTimeline';
import { TriageQueuePage } from './pages/TriageQueuePage';
import { CommsSimulationPage } from './pages/CommsSimulationPage';
import { RecoveryLeversPage } from './pages/RecoveryLeversPage';
import { PersonalBaselinesPage } from './pages/PersonalBaselinesPage';
import { DataTrustPage } from './pages/DataTrustPage';
import { IncidentReportPage } from './pages/IncidentReportPage';
import { CosmosProvider } from './cosmos/CosmosContext';
import { CosmicBackdrop } from './cosmos/CosmicBackdrop';
import { CosmicSceneSwitcher } from './cosmos/CosmicSceneSwitcher';
import { SolProvider, useMissionSol } from './context/SolContext';

const Shell: FC = () => {
  const location = useLocation();
  const { sol } = useMissionSol();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile navigation menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // The cosmos page is a full-bleed visual with no health data on it, so it
  // runs without the disclaimer bar and navigation header.
  const fullBleed = location.pathname.startsWith('/cosmos');

  // Custom isActive logic: Crew Board is active for /crew, /crew/:id and /alert/:id
  const isCrewActive =
    location.pathname === '/crew' ||
    location.pathname.startsWith('/crew/') ||
    location.pathname.startsWith('/alert/');
  const isDemoActive = location.pathname === '/demo';
  const isAboutActive = location.pathname === '/about';
  const isRecoveryActive = location.pathname === '/recovery';
  const isDriversActive = location.pathname === '/drivers';
  const isTriageActive = location.pathname === '/triage';
  const isCommsActive = location.pathname === '/comms';
  const isLeversActive = location.pathname === '/levers';
  const isBaselinesActive = location.pathname.startsWith('/baselines');
  const isTrustActive = location.pathname === '/trust';
  const isReportActive = location.pathname.startsWith('/report');

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-cyan-400 focus:ring-2 focus:ring-cyan-400 focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Accessible live region for screen readers notifying sol and status changes */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Active Mission Sol {sol}
      </div>

      {!fullBleed && (
        <>
          {/* Mandatory safety disclaimer on every data view */}
          <DisclaimerBar />

          {/* Navigation header */}
          <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-4 sm:px-6 py-3.5 sm:py-4 sticky top-0 z-50">
            <div className="container mx-auto flex items-center justify-between">
              <div className="flex items-center gap-4 lg:gap-8">
                <Link
                  to="/"
                  className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2 shrink-0"
                >
                  <span className="text-cyan-400">Orbit</span> Mafia
                </Link>

                {/* Desktop Navigation Links */}
                <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium">
                  <Link
                    to="/crew"
                    className={`${isCrewActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Crew Board
                  </Link>
                  <Link
                    to="/demo"
                    className={`${isDemoActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Mission Replay
                  </Link>
                  <Link
                    to="/about"
                    className={`${isAboutActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Data & Method
                  </Link>
                  <Link
                    to="/recovery"
                    className={`${isRecoveryActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Recovery
                  </Link>
                  <Link
                    to="/drivers"
                    className={`${isDriversActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Drivers
                  </Link>
                  <Link
                    to="/triage"
                    className={`${isTriageActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Triage
                  </Link>
                  <Link
                    to="/comms"
                    className={`${isCommsActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Comms
                  </Link>
                  <Link
                    to="/levers"
                    className={`${isLeversActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Levers
                  </Link>
                  <Link
                    to="/baselines/C001"
                    className={`${isBaselinesActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Baselines
                  </Link>
                  <Link
                    to="/trust"
                    className={`${isTrustActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Data Trust
                  </Link>
                  <Link
                    to="/report/C001"
                    className={`${isReportActive ? 'text-white' : 'text-slate-300'} hover:text-white transition-colors`}
                  >
                    Report
                  </Link>
                </nav>
              </div>

              {/* Sol Badge + Mobile Hamburger Toggle */}
              <div className="flex items-center gap-3">
                <div className="text-xs font-mono text-slate-400 px-2.5 py-1 rounded bg-slate-800/80 border border-slate-700/60 shrink-0">
                  SOL {sol}
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen((prev) => !prev)}
                  className="md:hidden p-2 rounded-lg text-slate-300 hover:text-white bg-slate-800/70 border border-slate-700/70 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors"
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X className="w-5 h-5 text-cyan-400" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Mobile Dropdown Navigation Menu */}
            {mobileMenuOpen && (
              <nav
                className="md:hidden mt-3 pt-3 border-t border-slate-800/80 flex flex-col gap-1 pb-2"
                aria-label="Mobile Navigation"
              >
                <Link
                  to="/crew"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isCrewActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Crew Board
                </Link>
                <Link
                  to="/demo"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDemoActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Mission Replay
                </Link>
                <Link
                  to="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isAboutActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Data & Method
                </Link>
                <Link
                  to="/recovery"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isRecoveryActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Recovery
                </Link>
                <Link
                  to="/drivers"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isDriversActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Drivers
                </Link>
                <Link
                  to="/triage"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isTriageActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Triage
                </Link>
                <Link
                  to="/comms"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isCommsActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Comms
                </Link>
                <Link
                  to="/levers"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isLeversActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Levers
                </Link>
                <Link
                  to="/baselines/C001"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isBaselinesActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Baselines
                </Link>
                <Link
                  to="/trust"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isTrustActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Data Trust
                </Link>
                <Link
                  to="/report/C001"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isReportActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Report
                </Link>
              </nav>
            )}
          </header>
        </>
      )}

      {/* Main page content */}
      <main id="main-content" className="flex-1 focus:outline-none" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<CrewBoard />} />
          <Route path="/crew" element={<CrewBoardPage />} />
          <Route path="/crew/:id" element={<AstronautDetail />} />
          <Route path="/alert/:id" element={<AlertScreen />} />
          <Route path="/demo" element={<DemoMode />} />
          <Route path="/about" element={<DataMethod />} />
          <Route path="/recovery" element={<BiomarkerRecovery />} />
          <Route path="/drivers" element={<DriverTimeline />} />
          <Route path="/triage" element={<TriageQueuePage />} />
          <Route path="/comms" element={<CommsSimulationPage />} />
          <Route path="/levers" element={<RecoveryLeversPage />} />
          <Route path="/baselines/:id" element={<PersonalBaselinesPage />} />
          <Route path="/baselines" element={<PersonalBaselinesPage />} />
          <Route path="/trust" element={<DataTrustPage />} />
          <Route path="/report/:id" element={<IncidentReportPage />} />
          <Route path="/report" element={<IncidentReportPage />} />
          <Route path="/cosmos/*" element={<CosmicSceneSwitcher />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: FC = () => {
  return (
    <BrowserRouter>
      <SolProvider>
        <CosmosProvider>
          {/* Animated ASCII universe behind every view; never takes pointer events */}
          <CosmicBackdrop />
          <Shell />
        </CosmosProvider>
      </SolProvider>
    </BrowserRouter>
  );
};

export default App;
