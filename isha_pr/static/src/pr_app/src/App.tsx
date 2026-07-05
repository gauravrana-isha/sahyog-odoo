import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  AppShell,
  Group,
  Text,
  Select,
  Center,
  Loader,
  UnstyledButton,
  Box,
} from '@mantine/core';
import { IconAddressBook, IconCalendarEvent } from '@tabler/icons-react';
import { usePR } from './hooks/usePR';

const ContactsPage = lazy(() =>
  import('./pages/ContactsPage').then((m) => ({ default: m.ContactsPage })));
const ContactDetail = lazy(() =>
  import('./pages/ContactDetail').then((m) => ({ default: m.ContactDetail })));

const NAV = [
  { label: 'Contacts', icon: IconAddressBook, path: '/contacts', cap: 'pr_view_contacts' },
  { label: 'Events', icon: IconCalendarEvent, path: '/events', cap: 'pr_view_events' },
] as const;

export function App() {
  const { me, loading, center, setCenter } = usePR();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) return <Center h="100vh"><Loader /></Center>;
  if (!me) return <Center h="100vh"><Text c="dimmed">Unable to load PR app.</Text></Center>;

  const visibleNav = NAV.filter((n) => me.can[n.cap]);

  return (
    <AppShell header={{ height: 56 }} footer={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Text fw={700} c="grape">Isha PR</Text>
          <Select
            size="xs"
            w={160}
            aria-label="Center"
            data={me.centers.map((c) => ({ value: String(c.id), label: c.name }))}
            value={center ? String(center.id) : null}
            onChange={(v) => {
              const c = me.centers.find((x) => String(x.id) === v);
              if (c) setCenter(c);
            }}
            placeholder="No centers"
          />
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Suspense fallback={<Center py="xl"><Loader /></Center>}>
          <Routes>
            <Route path="/" element={<Navigate to="/contacts" replace />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:id" element={<ContactDetail />} />
            <Route path="*" element={<Navigate to="/contacts" replace />} />
          </Routes>
        </Suspense>
      </AppShell.Main>

      <AppShell.Footer>
        <Group h="100%" gap={0} grow>
          {visibleNav.map((n) => {
            const active = location.pathname.startsWith(n.path);
            const Icon = n.icon;
            return (
              <UnstyledButton key={n.path} onClick={() => navigate(n.path)}
                aria-label={n.label}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 3, height: '100%',
                  color: active ? 'var(--mantine-color-grape-6)' : 'var(--mantine-color-dimmed)',
                }}>
                <Icon size={22} />
                <Box component="span" style={{ fontSize: 11, fontWeight: active ? 700 : 400 }}>
                  {n.label}
                </Box>
              </UnstyledButton>
            );
          })}
        </Group>
      </AppShell.Footer>
    </AppShell>
  );
}
