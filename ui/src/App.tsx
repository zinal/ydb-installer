import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { WizardPage } from './pages/session/WizardPage';
import { MonitorPage } from './pages/session/MonitorPage';
import { LogsPage } from './pages/LogsPage';
import { LogoutPage } from './pages/LogoutPage';
import { ResultsPage } from './pages/ResultsPage';
import { InstallationSessionProvider } from './session/InstallationSessionProvider';
import { AuthSessionProvider } from './session/AuthSessionProvider';
import { RequireAuth } from './navigation/RequireAuth';

export default function App() {
  return (
    <BrowserRouter>
      <AuthSessionProvider>
        <InstallationSessionProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/configuration"
                element={
                  <RequireAuth>
                    <WizardPage />
                  </RequireAuth>
                }
              />
              <Route path="/wizard" element={<Navigate to="/configuration" replace />} />
              <Route
                path="/monitoring"
                element={
                  <RequireAuth>
                    <MonitorPage />
                  </RequireAuth>
                }
              />
              <Route path="/monitor" element={<Navigate to="/monitoring" replace />} />
              <Route
                path="/logs"
                element={
                  <RequireAuth>
                    <LogsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/results"
                element={
                  <RequireAuth>
                    <ResultsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/logout"
                element={
                  <RequireAuth>
                    <LogoutPage />
                  </RequireAuth>
                }
              />
              <Route path="/sessions/:sessionId/wizard" element={<Navigate to="/configuration" replace />} />
              <Route path="/sessions/:sessionId/monitor" element={<Navigate to="/monitoring" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </InstallationSessionProvider>
      </AuthSessionProvider>
    </BrowserRouter>
  );
}
