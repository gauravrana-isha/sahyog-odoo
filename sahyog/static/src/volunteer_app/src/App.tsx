import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RequestPage } from './pages/RequestPage';
import { HistoryPage } from './pages/HistoryPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { CalendarPage } from './pages/CalendarPage';
import { ProfilePage } from './pages/ProfilePage';

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<ProgramsPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/request" element={<RequestPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
