import { useState, useEffect, type FC } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  LayoutGrid,
  ChevronRight,
  Activity,
  Radio,
  ShieldCheck,
  Scale,
  FileText,
  Compass,
  Sparkles,
} from 'lucide-react';
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
  const [featuresDrawerOpen, setFeaturesDrawerOpen] = useState(false);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setFeaturesDrawerOpen(false);
  }, [location.pathname]);

  // Close menus on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFeaturesDrawerOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

          {/* Navigation header with centralized primary links */}
          <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-4 sm:px-6 py-3 sticky top-0 z-50">
            <div className="container mx-auto flex items-center justify-between">
              {/* Left: Brand Logo */}
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to="/"
                  className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2"
                >
                  <span className="text-cyan-400">Orbit</span> Mafia
                </Link>
              </div>

              {/* Center: Centralized Primary Navigation */}
              <nav className="hidden md:flex items-center gap-3 lg:gap-5 text-sm font-medium" aria-label="Main Navigation">
                <Link to="/crew" className={`transition-colors py-1 px-2.5 rounded-md ${isCrewActive ? "text-cyan-300 font-semibold bg-slate-800/80 border border-cyan-800/50" : "text-slate-300 hover:text-white hover:bg-slate-800/50"}`}>Crew Board</Link>
                <Link to="/demo" className={`transition-colors py-1 px-2.5 rounded-md ${isDemoActive ? "text-cyan-300 font-semibold bg-slate-800/80 border border-cyan-800/50" : "text-slate-300 hover:text-white hover:bg-slate-800/50"}`}>Mission Replay</Link>
                <Link to="/triage" className={`transition-colors py-1 px-2.5 rounded-md ${isTriageActive ? "text-cyan-300 font-semibold bg-slate-800/80 border border-cyan-800/50" : "text-slate-300 hover:text-white hover:bg-slate-800/50"}`}>Triage</Link>
                <Link to="/comms" className={`transition-colors py-1 px-2.5 rounded-md ${isCommsActive ? "text-cyan-300 font-semibold bg-slate-800/80 border border-cyan-800/50" : "text-slate-300 hover:text-white hover:bg-slate-800/50"}`}>Comms</Link>
                <Link to="/recovery" className={`transition-colors py-1 px-2.5 rounded-md ${isRecoveryActive ? "text-cyan-300 font-semibold bg-slate-800/80 border border-cyan-800/50" : "text-slate-300 hover:text-white hover:bg-slate-800/50"}`}>Recovery</Link>
                <Link to="/drivers" className={`transition-colors py-1 px-2.5 rounded-md ${isDriversActive ? "text-cyan-300 font-semibold bg-slate-800/80 border border-cyan-800/50" : "text-slate-300 hover:text-white hover:bg-slate-800/50"}`}>Drivers</Link>
                <Link to="/about" className={`transition-colors py-1 px-2.5 rounded-md ${isAboutActive ? "text-cyan-300 font-semibold bg-slate-800/80 border border-cyan-800/50" : "text-slate-300 hover:text-white hover:bg-slate-800/50"}`}>Data & Method</Link>
              </nav>

              {/* Right: Side Features Pop-up Button + Sol Badge + Mobile Menu Toggle */}
              <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setFeaturesDrawerOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-cyan-300 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700/70 transition-all shadow-sm shadow-cyan-950/50"
                  aria-label="Open Features and Tools drawer"
                  aria-expanded={featuresDrawerOpen}
                >
                  <LayoutGrid className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline">Features & Tools</span>
                  <span className="sm:hidden">Features</span>
                </button>

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
                className="md:hidden mt-3 pt-3 border-t border-slate-800/80 flex flex-col gap-1 pb-2 max-h-[75vh] overflow-y-auto"
                aria-label="Mobile Navigation"
              >
                <div className="px-3 py-1 text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                  Core Views
                </div>
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

                <div className="px-3 pt-2 py-1 text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                  Biomedical & Physiology
                </div>
                <Link
                  to="/recovery"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isRecoveryActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Biomarker Recovery
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
                  Driver Timeline
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
                  Personal Baselines
                </Link>

                <div className="px-3 pt-2 py-1 text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                  Mission Safety & Tools
                </div>
                <Link
                  to="/triage"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isTriageActive
                      ? 'bg-cyan-950/70 text-cyan-300 font-semibold border border-cyan-800/60'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  Triage Priority Queue
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
                  Earth Link & Copilot
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
                  Recovery Levers
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
                  Data Trust Panel
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
                  Commander Incident Report
                </Link>
              </nav>
            )}
          </header>

          {/* Features & Tools Pop-up Slide-over Drawer */}
          {featuresDrawerOpen && (
            <div
              className="fixed inset-0 z-[70] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Features and Operational Tools"
            >
              {/* Dimmed Backdrop */}
              <div
                className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
                onClick={() => setFeaturesDrawerOpen(false)}
                aria-hidden="true"
              />

              <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-md bg-slate-900 border-l border-slate-700/80 shadow-2xl flex flex-col">
                  {/* Drawer Header */}
                  <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                    <div className="flex items-center gap-2.5">
                      <LayoutGrid className="w-5 h-5 text-cyan-400" />
                      <div>
                        <h2 className="text-base font-bold text-white tracking-tight">
                          Features & Operational Tools
                        </h2>
                        <p className="text-xs font-mono text-slate-400">
                          Complete telemetry and mission suite
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFeaturesDrawerOpen(false)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors"
                      aria-label="Close features drawer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Drawer Content Sections */}
                  <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Category 1: Mission Control */}
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold mb-2.5 flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5" />
                        <span>Mission Operations</span>
                      </h3>
                      <div className="space-y-1.5">
                        <Link
                          to="/crew"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isCrewActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">Crew Board</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Real-time 4-astronaut resilience dashboard & vitals
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
                        </Link>

                        <Link
                          to="/demo"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isDemoActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">Mission Replay</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Solar storm sequence playback across Sols 142ΓÇô147
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
                        </Link>

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
                              <span>Triage Priority Queue</span>
                              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Autonomous medical priority ranking based on telemetry
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
                        </Link>

                        <Link
                          to="/report/C001"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isReportActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                              <span>Commander Incident Report</span>
                              <FileText className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Printable mission debrief & telemetry synthesis
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
                        </Link>
                      </div>
                    </div>

                    {/* Category 2: Biomedical & Physiology */}
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold mb-2.5 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" />
                        <span>Biomedical & Physiology</span>
                      </h3>
                      <div className="space-y-1.5">
                        <Link
                          to="/recovery"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isRecoveryActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">Biomarker Recovery</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              NASA OSDR post-flight multi-omics & recovery curves
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
                        </Link>

                        <Link
                          to="/drivers"
                          onClick={() => setFeaturesDrawerOpen(false)}
                          className={`flex items-start justify-between p-3 rounded-lg border transition-all ${
                            isDriversActive
                              ? 'bg-cyan-950/60 border-cyan-700 text-cyan-200'
                              : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">Driver Timeline</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Multi-stressor compound risk timeline across sols
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
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
                              <span>Personal-Baseline Bands</span>
                              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Individualized mean ┬▒ 2╧â biometric stability divergence
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
                        </Link>
                      </div>
                    </div>

                    {/* Category 3: Mission Safety & Protocols */}
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold mb-2.5 flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5" />
                        <span>Mission Safety & Protocols</span>
                      </h3>
                      <div className="space-y-1.5">
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
                              <span>Earth-Link Comms</span>
                              <Radio className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Light-time delay dropout & autonomous copilot
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
                        </Link>

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
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
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
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
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
                          <ChevronRight className="w-4 h-4 text-slate-500 mt-1 shrink-0" />
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
        </>
      )}

      <main id="main-content" className="flex-1">
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
          <Route path="/trust" element={<DataTrustPage />} />
          <Route path="/report/:id" element={<IncidentReportPage />} />
        </Routes>
      </main>
    </div>
  );
};

export function App() {
  return (
    <BrowserRouter>
      <CosmosProvider>
        <CosmicBackdrop />
        <CosmicSceneSwitcher />
        <SolProvider>
          <Shell />
        </SolProvider>
      </CosmosProvider>
    </BrowserRouter>
  );
}

export default App;
