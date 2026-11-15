import { type FC } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { SolProvider } from './context/SolContext';

const Shell: FC = () => {
  return (
    <div className="relative z-10 min-h-screen flex flex-col text-slate-100">
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
