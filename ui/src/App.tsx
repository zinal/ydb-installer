import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { BatchPage } from './pages/BatchPage';
import { WizardPage } from './pages/session/WizardPage';
import { MonitorPage } from './pages/session/MonitorPage';
import { LogsPage } from './pages/LogsPage';
import { LogoutPage } from './pages/LogoutPage';
import { ResultsPage } from './pages/ResultsPage';
import { InstallationSessionProvider } from './session/InstallationSessionProvider';
import { AuthPrototypeProvider } from './session/AuthPrototypeProvider';

export default function App() {
  return (
    <BrowserRouter>
      <AuthPrototypeProvider>
        <InstallationSessionProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/configuration" element={<WizardPage />} />
              <Route path="/wizard" element={<Navigate to="/configuration" replace />} />
              <Route path="/monitoring" element={<MonitorPage />} />
              <Route path="/monitor" element={<Navigate to="/monitoring" replace />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/batch" element={<BatchPage />} />
              <Route path="/logout" element={<LogoutPage />} />
              <Route path="/sessions/:sessionId/wizard" element={<Navigate to="/configuration" replace />} />
              <Route path="/sessions/:sessionId/monitor" element={<Navigate to="/monitoring" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </InstallationSessionProvider>
      </AuthPrototypeProvider>
    </BrowserRouter>
  );
}
