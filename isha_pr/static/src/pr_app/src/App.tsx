import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Group,
  Text,
  Select,
  Center,
  Loader,
  UnstyledButton,
  Box,
  ActionIcon,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import {
  IconAddressBook,
  IconAward,
  IconChecklist,
  IconLayoutDashboard,
  IconSun,
  IconMoon,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconUserOff,
} from '@tabler/icons-react';
import { usePR } from './hooks/usePR';
import { EmptyState } from './components/EmptyState';

const ContactsPage = lazy(() =>
  import('./pages/ContactsPage').then((m) => ({ default: m.ContactsPage })));
const ContactDetail = lazy(() =>
  import('./pages/ContactDetail').then((m) => ({ default: m.ContactDetail })));
const NominationsPage = lazy(() =>
  import('./pages/NominationsPage').then((m) => ({ default: m.NominationsPage })));
const NominationDetail = lazy(() =>
  import('./pages/NominationDetail').then((m) => ({ default: m.NominationDetail })));
const FollowUpsPage = lazy(() =>
  import('./pages/FollowUpsPage').then((m) => ({ default: m.FollowUpsPage })));
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));

const NAV = [
  { label: 'Home', icon: IconLayoutDashboard, path: '/home', cap: 'pr_view_dashboard' },
  { label: 'Contacts', icon: IconAddressBook, path: '/contacts', cap: 'pr_view_contacts' },
  { label: 'Nominations', icon: IconAward, path: '/nominations', cap: 'pr_view_nominations' },
  { label: 'Follow-ups', icon: IconChecklist, path: '/follow-ups', cap: 'pr_view_followups' },
] as const;

const HEADER_H = 56;
const BOTTOM_H = 60;
const SIDEBAR_W = 280;
const SIDEBAR_COLLAPSED_W = 64;

const LOGO_SRC = '/isha_pr/static/description/icon.png';

export function App() {
  const { me, loading, center, setCenter } = usePR();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [sidebarOpen, { toggle: toggleSidebar }] = useDisclosure(true);
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const toggleColorScheme = () => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');

  if (loading) return <Center h="100vh"><Loader /></Center>;
  if (!me) {
    return (
      <Center h="100vh">
        <EmptyState
          icon={IconUserOff}
          title="Unable to load PR app"
          description="Your account may not have PR access. Contact an administrator."
        />
      </Center>
    );
  }

  const visibleNav = NAV.filter((n) => me.can[n.cap]);
  const showSidebar = isDesktop;
  const sidebarWidth = sidebarOpen ? SIDEBAR_W : SIDEBAR_COLLAPSED_W;
  const firstName = me.user.name ? me.user.name.split(' ')[0] : '';

  const centerSelect = (
    <Select
      size="xs"
      w={isDesktop ? 180 : 140}
      aria-label="Center"
      data={me.centers.map((c) => ({ value: String(c.id), label: c.name }))}
      value={center ? String(center.id) : null}
      onChange={(v) => {
        const c = me.centers.find((x) => String(x.id) === v);
        if (c) setCenter(c);
      }}
      placeholder="No centers"
    />
  );

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ── */}
      <Box
        component="header"
        style={{
          height: HEADER_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 16,
          paddingRight: 12,
          marginLeft: showSidebar ? sidebarWidth : 0,
          backgroundColor: 'var(--mantine-color-body)',
          borderBottom: '1px solid var(--mantine-color-default-border)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          transition: 'margin-left 0.2s ease',
        }}
      >
        {isDesktop ? (
          <Text size="md" c="dimmed" ff="heading" fs="italic">
            Namaskaram{firstName ? `, ${firstName}` : ''}
          </Text>
        ) : (
          <Group gap={8} align="center" wrap="nowrap">
            <img src={LOGO_SRC} alt="Isha PR" style={{ width: 28, height: 28, borderRadius: 6 }} />
            <Text fw={600} size="lg" ff="heading" style={{ color: 'light-dark(var(--mantine-color-clay-7), var(--mantine-color-clay-3))' }}>
              Isha PR
            </Text>
          </Group>
        )}
        <Group gap={8} wrap="nowrap">
          {centerSelect}
          <ActionIcon variant="subtle" size="lg" aria-label="Toggle dark mode" onClick={toggleColorScheme}>
            {computedColorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
          </ActionIcon>
        </Group>
      </Box>

      <Box style={{ display: 'flex', flex: 1 }}>
        {/* ── Desktop Sidebar ── */}
        {showSidebar && (
          <Box component="nav" style={{
            width: sidebarWidth, flexShrink: 0,
            borderRight: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-body)',
            position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 101,
            display: 'flex', flexDirection: 'column',
            transition: 'width 0.2s ease',
            overflow: 'hidden',
          }}>
            {/* Sidebar header: logo in a stationary 40px slot; when collapsed
                it doubles as the expand button (icon on hover) */}
            <Box style={{
              height: HEADER_H,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              borderBottom: '1px solid var(--mantine-color-default-border)',
              flexShrink: 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}>
              {sidebarOpen ? (
                <>
                  <Center style={{ width: 40, flexShrink: 0 }}>
                    <img src={LOGO_SRC} alt="Isha PR" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  </Center>
                  <Text fw={600} size="lg" ff="heading" style={{ flex: 1, color: 'light-dark(var(--mantine-color-clay-7), var(--mantine-color-clay-3))' }}>
                    Isha PR
                  </Text>
                  <ActionIcon variant="subtle" size="sm" onClick={toggleSidebar} aria-label="Collapse sidebar" color="gray">
                    <IconLayoutSidebarLeftCollapse size={18} />
                  </ActionIcon>
                </>
              ) : (
                <UnstyledButton
                  className="sahyog-logo-swap"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                  style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--mantine-radius-md)' }}
                >
                  <span className="sahyog-swap-main">
                    <img src={LOGO_SRC} alt="Isha PR" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  </span>
                  <span className="sahyog-swap-alt" style={{ color: 'var(--mantine-color-dimmed)' }}>
                    <IconLayoutSidebarLeftExpand size={22} />
                  </span>
                </UnstyledButton>
              )}
            </Box>

            {/* Nav items: fixed 40px icon column so icons stay put while the
                sidebar animates; labels just fade */}
            <Box style={{ flex: 1, paddingTop: 8, paddingLeft: 12, paddingRight: 12, overflow: 'hidden' }}>
              {visibleNav.map((item) => {
                const active = location.pathname.startsWith(item.path);
                const Icon = item.icon;
                return (
                  <UnstyledButton
                    key={item.path}
                    className="sahyog-nav-item"
                    data-active={active || undefined}
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      height: 40,
                      marginBottom: 2,
                      borderRadius: 'var(--mantine-radius-md)',
                      backgroundColor: active ? 'var(--mantine-color-clay-light)' : undefined,
                      color: active ? 'var(--mantine-color-clay-light-color)' : 'var(--mantine-color-text)',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Center style={{ width: 40, flexShrink: 0 }}>
                      <Icon size={20} />
                    </Center>
                    <Text
                      size="sm"
                      fw={active ? 600 : 400}
                      style={{ opacity: sidebarOpen ? 1 : 0, transition: 'opacity 0.15s ease' }}
                    >
                      {item.label}
                    </Text>
                  </UnstyledButton>
                );
              })}
            </Box>
          </Box>
        )}

        {/* ── Main Content ── */}
        <Box component="main" style={{
          flex: 1,
          marginLeft: showSidebar ? sidebarWidth : 0,
          paddingTop: 16, paddingLeft: 16, paddingRight: 16,
          paddingBottom: isDesktop ? 16 : BOTTOM_H + 16,
          width: '100%', boxSizing: 'border-box',
          transition: 'margin-left 0.2s ease',
        }}>
          <Suspense fallback={<Center py="xl"><Loader /></Center>}>
            {/* Keyed by pathname so each route change gets a subtle enter animation */}
            <Box key={location.pathname} className="sahyog-page-enter">
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<DashboardPage />} />
                <Route path="/contacts" element={<ContactsPage />} />
                <Route path="/contacts/:id" element={<ContactDetail />} />
                <Route path="/nominations" element={<NominationsPage />} />
                <Route path="/nominations/:id" element={<NominationDetail />} />
                <Route path="/follow-ups" element={<FollowUpsPage />} />
                <Route path="*" element={<Navigate to="/contacts" replace />} />
              </Routes>
            </Box>
          </Suspense>
        </Box>
      </Box>

      {/* ── Mobile Bottom Nav ── */}
      {!isDesktop && (
        <Box component="nav" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: BOTTOM_H,
          backgroundColor: 'var(--mantine-color-body)',
          borderTop: '1px solid var(--mantine-color-default-border)',
          display: 'flex',
          zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {visibleNav.map((n) => {
            const active = location.pathname.startsWith(n.path);
            const Icon = n.icon;
            return (
              <UnstyledButton key={n.path} onClick={() => navigate(n.path)}
                aria-label={n.label} aria-current={active ? 'page' : undefined}
                style={{
                  flex: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: 2, minHeight: 44,
                }}>
                <Box
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '3px 14px', borderRadius: 999,
                    backgroundColor: active ? 'var(--mantine-color-clay-light)' : 'transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <Icon size={22} color={active ? 'var(--mantine-color-clay-light-color)' : 'var(--mantine-color-dimmed)'} />
                </Box>
                <Box component="span" style={{
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--mantine-color-clay-light-color)' : 'var(--mantine-color-dimmed)',
                }}>
                  {n.label}
                </Box>
              </UnstyledButton>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
