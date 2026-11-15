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
  RefreshCw,
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
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 600);
  };

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
          {/* Navigation header with all features clearly displayed at the top */}
          <header className="glass-nav px-4 sm:px-6 py-2.5">
            <div className="container mx-auto flex items-center justify-between">
              {/* Left: Brand Logo */}
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to="/"
                  className="flex items-center shrink-0 hover:opacity-90 transition-opacity"
                  aria-label="Orbit Mafia Home"
                >
                  <OrbitMafiaLogo className="h-8 sm:h-9 w-auto" />
                </Link>
              </div>

              {/* Right: Notification Bell + Features Drawer Button + Sol Badge */}
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <NotificationBell />

                <button
                  type="button"
                  onClick={() => setFeaturesDrawerOpen(true)}
                  className="glass-btn-features flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-cyan-300 cursor-pointer"
                  aria-label="Open Features and Tools drawer"
                  aria-expanded={featuresDrawerOpen}
                >
                  <LayoutGrid className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline">All Features</span>
                  <span className="sm:hidden">Features</span>
                </button>

                <div className="glass-btn-sm text-xs font-mono text-slate-300 px-2.5 py-1 rounded-lg shrink-0">
                  SOL {sol}
                </div>
              </div>
            </div>
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
        
          {/* Floating Pill Navigation Dock (matching capsule style from screenshot) */}
          <aside
            className="fixed bottom-6 sm:bottom-8 inset-x-0 z-40 flex justify-center pointer-events-none px-4"
            aria-label="Floating Navigation Bar"
          >
            <nav
              className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-full bg-slate-900/85 backdrop-blur-2xl border border-white/15 shadow-[0_20px_48px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.15)] max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none"
              aria-label="Primary Navigation"
            >
              <Link
                to="/crew"
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  isCrewActive
                    ? 'bg-white text-slate-950 font-semibold shadow-[0_2px_10px_rgba(255,255,255,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                Crew Board
              </Link>
              <Link
                to="/demo"
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  isDemoActive
                    ? 'bg-white text-slate-950 font-semibold shadow-[0_2px_10px_rgba(255,255,255,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                Mission Replay
              </Link>
              <Link
                to="/triage"
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  isTriageActive
                    ? 'bg-white text-slate-950 font-semibold shadow-[0_2px_10px_rgba(255,255,255,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                Triage
              </Link>
              <Link
                to="/comms"
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  isCommsActive
                    ? 'bg-white text-slate-950 font-semibold shadow-[0_2px_10px_rgba(255,255,255,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                Comms Lag
              </Link>
              <Link
                to="/recovery"
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  isRecoveryActive
                    ? 'bg-white text-slate-950 font-semibold shadow-[0_2px_10px_rgba(255,255,255,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                Recovery
              </Link>
              <Link
                to="/drivers"
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  isDriversActive
                    ? 'bg-white text-slate-950 font-semibold shadow-[0_2px_10px_rgba(255,255,255,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
                }`}
              >
                Drivers
              </Link>
              <Link
                to="/about"
                className={`px-3.5 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm whitespace-nowrap transition-all duration-200 ${
                  isAboutActive
                    ? 'bg-white text-slate-950 font-semibold shadow-[0_2px_10px_rgba(255,255,255,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10 font-medium'
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

      {!fullBleed && (
        <footer className="border-t border-slate-800/80 bg-slate-950/90 py-4 px-4 sm:px-6 text-center text-xs text-slate-300 font-mono z-20 relative">
          <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              ORBIT MAFIA // AUTONOMOUS CREW HEALTH GUARDIAN
            </span>
            <span className="text-slate-400">
              Risk flags and suggested countermeasures only. Not a medical diagnosis.
            </span>
            <span className="text-cyan-400/90">SOL {sol} TELEMETRY</span>
          </div>
        </footer>
      )}
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
