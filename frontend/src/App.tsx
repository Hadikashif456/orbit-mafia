import { useState, useEffect, type FC } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  X,
  LayoutGrid,
  ChevronRight,
  Activity,
  Radio,
  ShieldCheck,
  Scale,
  FileText,
} from 'lucide-react';
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
import { OrbitMafiaLogo } from './components/OrbitMafiaLogo';
import { AlertPopupHost, NotificationBell } from './components/alerts/AlertPopupHost';
import './styles/alertPopup.css';

const Shell: FC = () => {
  const location = useLocation();
  const { sol } = useMissionSol();
  const [featuresDrawerOpen, setFeaturesDrawerOpen] = useState(false);


  // Close menus on route change
  useEffect(() => {
    setFeaturesDrawerOpen(false);
  }, [location.pathname]);

  // Close menus on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFeaturesDrawerOpen(false);
          }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // The cosmos page is a full-bleed visual with no health data on it, so it
  // runs without the disclaimer bar and navigation header.
  const fullBleed = location.pathname.startsWith('/cosmos');

  // Active state helpers
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

      {/* Accessible live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Active Mission Sol {sol}
      </div>

      {!fullBleed && (
        <>
          {/* Top Brand Header (Centered Logo) */}
          <header className="pt-4 pb-2 px-4 flex items-center justify-center relative z-30">
            <Link
              to="/"
              className="flex items-center shrink-0 hover:opacity-90 transition-opacity"
              aria-label="Orbit Mafia Home"
            >
              <OrbitMafiaLogo className="h-8 sm:h-9 w-auto" />
            </Link>
          </header>

          {/* Features Drawer */}
          {featuresDrawerOpen && (
            <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
              <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
                onClick={() => setFeaturesDrawerOpen(false)}
              />
              <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-md glass-dropdown border-l border-white/[0.1] flex flex-col shadow-2xl">
                  {/* Drawer Header */}
                  <div className="p-4 sm:p-6 border-b border-white/[0.08] flex items-center justify-between bg-slate-950/40 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-5 h-5 text-cyan-400" />
                      <h2 className="text-base font-bold text-white tracking-tight">Features & Advanced Tools</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFeaturesDrawerOpen(false)}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Drawer Body */}
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                        Operational Features
                      </h3>
                      <div className="grid gap-2">
                        <Link
                          to="/triage"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isTriageActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                              <span>Triage Queue</span>
                              <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Automated astronaut ranking by criticality and rate of change
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        </Link>

                        <Link
                          to="/comms"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isCommsActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                              <span>Earth Comms Simulation</span>
                              <Radio className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Latency buffer simulation with autonomous offline Copilot
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        </Link>

                        <Link
                          to="/baselines/C001"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isBaselinesActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                              <span>Personal Baselines</span>
                              <Activity className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Mission Sol 1–14 baseline bands and anomaly flags
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        </Link>

                        <Link
                          to="/report/C002"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isReportActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                              <span>Printable Incident Report</span>
                              <FileText className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Print-optimized medical incident debrief and commander signoff
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        </Link>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                        Scientific Models
                      </h3>
                      <div className="grid gap-2">
                        <Link
                          to="/levers"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isLeversActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                              <span>Recovery Levers</span>
                              <Scale className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Potential CRI points gained per restored factor
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        </Link>

                        <Link
                          to="/trust"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isTrustActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                              <span>Data Trust & Ethics</span>
                              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              NASA OSDR provenance matrix & scientific boundaries
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        </Link>

                        <Link
                          to="/about"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isAboutActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">Data & Method</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Mathematical formulas, weights, and documentation
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                        </Link>
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer */}
                  <div className="p-4 border-t border-slate-800 bg-slate-950/70 text-xs text-slate-400 flex items-center justify-between font-mono">
                    <span>SOL {sol}</span>
                    <span className="text-[11px] text-cyan-400">ORBIT MAFIA // TELEMETRY</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Floating Controls & Navigation Dock (matching photo) */}
          <aside
            className="fixed bottom-4 sm:bottom-6 inset-x-0 z-40 flex flex-col items-center pointer-events-none px-4 gap-2.5"
            aria-label="Floating Navigation and Utilities"
          >
            {/* Top Row: Utilities (Notification Bell + All Features + Sol Counter) */}
            <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3">
              <NotificationBell />

              <button
                type="button"
                onClick={() => setFeaturesDrawerOpen(true)}
                className="glass-btn-features flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium text-cyan-300 cursor-pointer"
                aria-label="Open Features and Tools drawer"
                aria-expanded={featuresDrawerOpen}
              >
                <LayoutGrid className="w-4 h-4 text-cyan-400" />
                <span>All Features</span>
              </button>

              <div className="glass-btn-sm text-xs font-mono text-slate-300 px-3 py-1.5 rounded-lg shrink-0">
                SOL {sol}
              </div>
            </div>

            {/* Bottom Row: Navigation Dock */}
            <nav
              className="pointer-events-auto flex items-center gap-1 sm:gap-2 px-4 py-2 rounded-full bg-slate-900/80 backdrop-blur-2xl border border-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.65)] max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none"
              aria-label="Primary Navigation"
            >
              <Link
                to="/crew"
                className={`px-3 sm:px-3.5 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  isCrewActive
                    ? 'text-cyan-300 bg-white/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Crew Board
              </Link>
              <Link
                to="/demo"
                className={`px-3 sm:px-3.5 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  isDemoActive
                    ? 'text-cyan-300 bg-white/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Mission Replay
              </Link>
              <Link
                to="/triage"
                className={`px-3 sm:px-3.5 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  isTriageActive
                    ? 'text-cyan-300 bg-white/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Triage
              </Link>
              <Link
                to="/comms"
                className={`px-3 sm:px-3.5 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  isCommsActive
                    ? 'text-cyan-300 bg-white/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Comms Lag
              </Link>
              <Link
                to="/recovery"
                className={`px-3 sm:px-3.5 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  isRecoveryActive
                    ? 'text-cyan-300 bg-white/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Recovery
              </Link>
              <Link
                to="/drivers"
                className={`px-3 sm:px-3.5 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  isDriversActive
                    ? 'text-cyan-300 bg-white/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Drivers
              </Link>
              <Link
                to="/about"
                className={`px-3 sm:px-3.5 py-1 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  isAboutActive
                    ? 'text-cyan-300 bg-white/10'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                Data & Method
              </Link>
            </nav>
          </aside>
        </>
      )}

      {/* Main page content */}
      <main id="main-content" className="flex-1 focus:outline-none pb-28 sm:pb-32" tabIndex={-1}>
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
          {/* Animated ASCII universe behind every view */}
          <CosmicBackdrop />
          <AlertPopupHost />
          <Shell />
        </CosmosProvider>
      </SolProvider>
    </BrowserRouter>
  );
};

export default App;
