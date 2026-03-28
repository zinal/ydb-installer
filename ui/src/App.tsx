import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { BatchPage } from './pages/BatchPage';
import { WizardPage } from './pages/session/WizardPage';
import { MonitorPage } from './pages/session/MonitorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/batch" element={<BatchPage />} />
          <Route path="/sessions/:sessionId/wizard" element={<WizardPage />} />
          <Route path="/sessions/:sessionId/monitor" element={<MonitorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
