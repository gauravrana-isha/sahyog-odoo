import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box, Center, Loader } from '@mantine/core';
import { AppLayout } from './components/AppLayout';
import { Protected } from './hooks/useCapabilities';

// Lazy-loaded per page so volunteers only download the code for the routes
// they actually visit (P3.1). Named exports are adapted to default here.
const RequestPage = lazy(() => import('./pages/RequestPage').then((m) => ({ default: m.RequestPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const ProgramsPage = lazy(() => import('./pages/ProgramsPage').then((m) => ({ default: m.ProgramsPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const GuestsPage = lazy(() => import('./pages/GuestsPage').then((m) => ({ default: m.GuestsPage })));
const GuestVisitDetail = lazy(() => import('./pages/GuestVisitDetail').then((m) => ({ default: m.GuestVisitDetail })));

export function App() {
  const location = useLocation();
  return (
    <AppLayout>
      <Suspense fallback={<Center py="xl"><Loader /></Center>}>
      {/* Keyed by pathname so each route change gets a subtle enter animation */}
      <Box key={location.pathname} className="sahyog-page-enter">
      <Routes>
        <Route path="/" element={<ProgramsPage />} />
        <Route path="/programs" element={<Protected cap="view_programs"><ProgramsPage /></Protected>} />
        <Route path="/history" element={<Protected cap="view_history"><HistoryPage /></Protected>} />
        <Route path="/guests" element={<Protected cap="view_guests"><GuestsPage /></Protected>} />
        <Route path="/guests/:visitId" element={<Protected cap="view_guests"><GuestVisitDetail /></Protected>} />
        <Route path="/request" element={<Protected cap="submit_requests"><RequestPage /></Protected>} />
        <Route path="/calendar" element={<Protected cap="view_calendar"><CalendarPage /></Protected>} />
        <Route path="/profile" element={<Protected cap="view_profile"><ProfilePage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Box>
      </Suspense>
    </AppLayout>
  );
}
