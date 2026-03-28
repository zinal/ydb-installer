import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { BatchPage } from './pages/BatchPage';
import { WizardPage } from './pages/session/WizardPage';
import { MonitorPage } from './pages/session/MonitorPage';
import { InstallationSessionProvider } from './session/InstallationSessionProvider';

export default function App() {
  return (
    <BrowserRouter>
      <InstallationSessionProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/batch" element={<BatchPage />} />
            <Route path="/wizard" element={<WizardPage />} />
            <Route path="/monitor" element={<MonitorPage />} />
            <Route path="/sessions/:sessionId/wizard" element={<Navigate to="/wizard" replace />} />
            <Route path="/sessions/:sessionId/monitor" element={<Navigate to="/monitor" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </InstallationSessionProvider>
    </BrowserRouter>
  );
}
