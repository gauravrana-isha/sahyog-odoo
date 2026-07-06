import { type ReactNode, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Text,
  UnstyledButton,
  Stack,
  ActionIcon,
  Avatar,
  Indicator,
  Drawer,
  Card,
  Group,
  Button,
  Center,
  Loader,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconSend,
  IconHistory,
  IconCalendar,
  IconUser,
  IconBell,
  IconCheck,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconBooks,
  IconSun,
  IconMoon,
  IconX,
  IconUsers,
} from '@tabler/icons-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { apiGet, apiPost } from '../api';
import type { Notification } from '../types';
import { InstallBanner } from './InstallBanner';
import { useCan } from '../hooks/useCapabilities';

function parseActionTokens(message: string): Array<{ type: 'text'; content: string } | { type: 'action'; path: string; entryType: string; id: string }> {
  const regex = /\[\[action:([^|]+)\|([^|]+)\|([^\]]+)\]\]/g;
  const parts: Array<{ type: 'text'; content: string } | { type: 'action'; path: string; entryType: string; id: string }> = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(message)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: message.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'action', path: match[1], entryType: match[2], id: match[3] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < message.length) {
    parts.push({ type: 'text', content: message.slice(lastIndex) });
  }
  return parts;
}

// Bottom nav: 5 items (no Profile). `cap` gates visibility via /api/me.
const BOTTOM_NAV = [
  { label: 'Programs', icon: IconBooks, path: '/programs', cap: 'view_programs' },
  { label: 'History', icon: IconHistory, path: '/history', cap: 'view_history' },
  { label: 'Guests', icon: IconUsers, path: '/guests', cap: 'view_guests' },
  { label: 'Request', icon: IconSend, path: '/request', cap: 'submit_requests' },
  { label: 'Calendar', icon: IconCalendar, path: '/calendar', cap: 'view_calendar' },
] as const;

// Sidebar nav: all 6 items.
const SIDEBAR_NAV = [
  { label: 'Programs', icon: IconBooks, path: '/programs', cap: 'view_programs' },
  { label: 'History', icon: IconHistory, path: '/history', cap: 'view_history' },
  { label: 'Guests', icon: IconUsers, path: '/guests', cap: 'view_guests' },
  { label: 'Request', icon: IconSend, path: '/request', cap: 'submit_requests' },
  { label: 'Calendar', icon: IconCalendar, path: '/calendar', cap: 'view_calendar' },
  { label: 'Profile', icon: IconUser, path: '/profile', cap: 'view_profile' },
] as const;

const HEADER_H = 56;
const MOBILE_HEADER_H = 60;
const BOTTOM_H = 64;
const SIDEBAR_W = 280;
const SIDEBAR_COLLAPSED_W = 64;

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // Sidebar open/collapsed state survives reloads (per browser).
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('sahyog_sidebar') !== 'collapsed'; }
    catch { return true; }
  });
  const toggleSidebar = () => setSidebarOpen((open) => {
    const next = !open;
    try { localStorage.setItem('sahyog_sidebar', next ? 'open' : 'collapsed'); }
    catch { /* ignore */ }
    return next;
  });
  const can = useCan();
  const sidebarNav = SIDEBAR_NAV.filter((item) => can(item.cap));
  const bottomNav = BOTTOM_NAV.filter((item) => can(item.cap));

  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [volunteerId, setVolunteerId] = useState<number | null>(null);
  const [volunteerName, setVolunteerName] = useState<string | null>(null);

  const fetchUnread = useCallback(() => {
    apiGet<{ count: number }>('/notifications/unread-count')
      .then((r) => setUnreadCount(r.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  // Fetch volunteer ID (profile photo) and name (header greeting)
  useEffect(() => {
    apiGet<{ id: number; name?: string }>('/profile')
      .then((data) => {
        setVolunteerId(data.id);
        if (data.name) setVolunteerName(data.name);
      })
      .catch(() => {});
  }, []);

  const fetchNotifications = useCallback(() => {
    setNotifLoading(true);
    apiGet<Notification[]>('/notifications')
      .then((data) => setNotifications(data))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  useEffect(() => {
    if (notifDrawerOpen) fetchNotifications();
  }, [notifDrawerOpen, fetchNotifications]);

  const markRead = async (id: number) => {
    try {
      await apiPost('/notifications/read', { notification_id: id });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      const result = await apiGet<{ count: number }>('/notifications/unread-count');
      setUnreadCount(result.count);
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await apiPost('/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const clearAll = async () => {
    try {
      await apiPost('/notifications/clear', {});
      setNotifications([]);
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const deleteNotification = async (id: number) => {
    try {
      await apiPost('/notifications/delete', { notification_id: id });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const result = await apiGet<{ count: number }>('/notifications/unread-count');
      setUnreadCount(result.count);
    } catch { /* silent */ }
  };

  const activePath = location.pathname;
  const isProfileOpen = activePath === '/profile';
  const showSidebar = isDesktop;
  const sidebarWidth = sidebarOpen ? SIDEBAR_W : SIDEBAR_COLLAPSED_W;
  const showBottomNav = !isDesktop && !isProfileOpen;
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const toggleColorScheme = () => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');

  // On mobile, profile opens as drawer; navigate to /profile content inside drawer
  const handleProfileClick = () => {
    if (isDesktop) {
      navigate('/profile');
    } else {
      navigate('/profile');
    }
  };

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── PWA Install Banner (top of screen; offset so the fixed sidebar doesn't cover it) ── */}
      <Box style={{ marginLeft: showSidebar ? sidebarWidth : 0, transition: 'margin-left 0.2s ease' }}>
        <InstallBanner />
      </Box>

      {/* ── Header ── */}
      <Box
        component="header"
        style={{
          height: isDesktop ? HEADER_H : MOBILE_HEADER_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: isDesktop ? 24 : 16,
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
        {isDesktop && (
          <Text size="md" c="dimmed" ff="heading" fs="italic">
            Namaskaram{volunteerName ? `, ${volunteerName.split(' ')[0]}` : ''}
          </Text>
        )}
        {!isDesktop && (
          <Group gap="xs">
            {isProfileOpen ? (
              <Text fw={600} size="xl">Profile</Text>
            ) : (
              <Group gap={10} align="center">
                <img
                  src="/sahyog/static/pwa/icon-192.png"
                  alt="Sahyog"
                  style={{ width: 32, height: 32, borderRadius: 6 }}
                />
                <Text fw={600} size="xl" ff="heading" style={{ color: 'light-dark(var(--mantine-color-clay-7), var(--mantine-color-clay-3))' }}>Sahyog</Text>
              </Group>
            )}
          </Group>
        )}
        <Group gap={6}>
          {!isDesktop && isProfileOpen ? (
            <ActionIcon variant="subtle" size="lg" aria-label="Close profile" onClick={() => navigate(-1)}>
              <IconX size={22} />
            </ActionIcon>
          ) : (
            <>
              <ActionIcon variant="subtle" size="lg" aria-label="Toggle dark mode" onClick={toggleColorScheme}>
                {computedColorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
              </ActionIcon>
              <ActionIcon variant="subtle" size="lg" aria-label="Notifications" onClick={() => setNotifDrawerOpen(true)} style={{ overflow: 'visible' }}>
                <Indicator disabled={unreadCount === 0} label={unreadCount > 99 ? '99+' : String(unreadCount)} size={18} color="red" offset={2}
                  styles={{ indicator: { padding: '0 4px', minWidth: 18, height: 18, fontSize: 10 } }}>
                  <IconBell size={22} />
                </Indicator>
              </ActionIcon>
              <ActionIcon variant="subtle" size="lg" aria-label="Profile" onClick={handleProfileClick}>
                <Avatar size={32} radius="xl" color="clay" src={volunteerId ? `/web/image/hr.employee/${volunteerId}/avatar_128` : undefined}><IconUser size={18} /></Avatar>
              </ActionIcon>
            </>
          )}
        </Group>
      </Box>

      <Box style={{ display: 'flex', flex: 1 }}>
        {/* ── Desktop Sidebar (Notion-style) ── */}
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
            {/* Sidebar header: logo sits in a stationary 40px slot; when
                collapsed it doubles as the expand button (icon on hover) */}
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
                    <img
                      src="/sahyog/static/pwa/icon-192.png"
                      alt="Sahyog"
                      style={{ width: 28, height: 28, borderRadius: 6 }}
                    />
                  </Center>
                  <Text fw={600} size="lg" ff="heading" style={{ flex: 1, color: 'light-dark(var(--mantine-color-clay-7), var(--mantine-color-clay-3))' }}>Sahyog</Text>
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
                    <img
                      src="/sahyog/static/pwa/icon-192.png"
                      alt="Sahyog"
                      style={{ width: 28, height: 28, borderRadius: 6 }}
                    />
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
              {sidebarNav.map((item) => {
                const active = activePath === item.path;
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
          paddingBottom: isDesktop ? 16 : (isProfileOpen ? 16 : BOTTOM_H + 16),
          paddingTop: 16, paddingLeft: 16, paddingRight: 16,
          maxWidth: isDesktop ? undefined : 1024,
          marginInline: isDesktop ? undefined : 'auto',
          width: '100%', boxSizing: 'border-box',
          transition: 'margin-left 0.2s ease',
        }}>
          {children}
        </Box>
      </Box>

      {/* ── Mobile Bottom Nav (4 items, hidden on profile) ── */}
      {showBottomNav && (
        <Box component="nav" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: BOTTOM_H,
          backgroundColor: 'var(--mantine-color-body)',
          borderTop: '1px solid var(--mantine-color-default-border)',
          display: 'flex',
          zIndex: 100,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}>
          {bottomNav.map((item) => {
            const active = activePath === item.path || (item.path === '/programs' && activePath === '/');
            const Icon = item.icon;
            return (
              <UnstyledButton
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 2,
                  minHeight: 44,
                }}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Box
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3px 14px',
                    borderRadius: 999,
                    backgroundColor: active ? 'var(--mantine-color-clay-light)' : 'transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <Icon
                    size={22}
                    color={active ? 'var(--mantine-color-clay-light-color)' : 'var(--mantine-color-dimmed)'}
                  />
                </Box>
                <Text
                  size="11px"
                  c={active ? 'clay' : 'dimmed'}
                  fw={active ? 600 : 400}
                >
                  {item.label}
                </Text>
              </UnstyledButton>
            );
          })}
        </Box>
      )}

      {/* ── Notification Drawer ── */}
      <Drawer opened={notifDrawerOpen} onClose={() => setNotifDrawerOpen(false)} position="right"
        size={isDesktop ? 360 : '100%'} title={<Text fw={600} size="lg">Notifications</Text>}>
        {notifLoading ? (
          <Center py="xl"><Loader size="sm" /></Center>
        ) : notifications.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconCheck size={40} color="var(--mantine-color-green-5)" />
              <Text c="dimmed">All caught up</Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap="xs">
            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" size="compact-xs" onClick={markAllRead}>Mark All Read</Button>
              <Button variant="subtle" size="compact-xs" color="red" onClick={clearAll}>Clear All</Button>
            </Group>
            {notifications.map((n) => (
              <Card key={n.id} padding="sm" withBorder style={{ backgroundColor: n.is_read ? undefined : 'var(--mantine-color-clay-light)', position: 'relative' }}>
                <ActionIcon variant="subtle" size="xs" color="gray" style={{ position: 'absolute', top: 6, right: 6 }}
                  onClick={() => deleteNotification(n.id)} aria-label="Delete notification">
                  <IconX size={14} />
                </ActionIcon>
                <Text size="sm" fw={600} pr={20}>{n.title}</Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {parseActionTokens(n.message).map((part, i) =>
                    part.type === 'text' ? <span key={i}>{part.content}</span> :
                    <Text key={i} component={Link} to={part.path} size="xs" c="clay" style={{ cursor: 'pointer' }}
                      onClick={() => { markRead(n.id); setNotifDrawerOpen(false); }}>View</Text>
                  )}
                </Text>
                <Group justify="space-between" mt="xs">
                  <Text size="xs" c="dimmed">
                    {n.create_date ? formatDistanceToNow(parseISO(n.create_date.endsWith('Z') ? n.create_date : n.create_date + 'Z'), { addSuffix: true }) : ''}
                  </Text>
                  {!n.is_read && (
                    <Button variant="subtle" size="compact-xs" onClick={() => markRead(n.id)}>Mark as Read</Button>
                  )}
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Drawer>
    </Box>
  );
}
