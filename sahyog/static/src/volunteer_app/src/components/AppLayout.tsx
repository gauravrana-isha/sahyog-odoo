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
  NavLink,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import {
  IconSend,
  IconHistory,
  IconCalendar,
  IconUser,
  IconBell,
  IconCheck,
  IconMenu2,
  IconLayoutSidebarLeftCollapse,
  IconBooks,
  IconSun,
  IconMoon,
  IconX,
} from '@tabler/icons-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { apiGet, apiPost } from '../api';
import type { Notification } from '../types';

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

// Bottom nav: 4 items (no Profile)
const BOTTOM_NAV = [
  { label: 'Programs', icon: IconBooks, path: '/programs' },
  { label: 'History', icon: IconHistory, path: '/history' },
  { label: 'Request', icon: IconSend, path: '/request' },
  { label: 'Calendar', icon: IconCalendar, path: '/calendar' },
] as const;

// Sidebar nav: all 5 items
const SIDEBAR_NAV = [
  { label: 'Programs', icon: IconBooks, path: '/programs' },
  { label: 'History', icon: IconHistory, path: '/history' },
  { label: 'Request', icon: IconSend, path: '/request' },
  { label: 'Calendar', icon: IconCalendar, path: '/calendar' },
  { label: 'Profile', icon: IconUser, path: '/profile' },
] as const;

const HEADER_H = 56;
const BOTTOM_H = 64;
const SIDEBAR_W = 280;

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [sidebarOpen, { toggle: toggleSidebar }] = useDisclosure(true);

  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

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

  const activePath = location.pathname;
  const isProfileOpen = activePath === '/profile';
  const showSidebar = isDesktop && sidebarOpen;
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
          backgroundColor: 'var(--mantine-color-body)',
          borderBottom: '1px solid var(--mantine-color-default-border)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Group gap="xs">
          {isDesktop && (
            <ActionIcon variant="subtle" size="lg" onClick={toggleSidebar} aria-label="Toggle sidebar">
              {sidebarOpen ? <IconLayoutSidebarLeftCollapse size={22} /> : <IconMenu2 size={22} />}
            </ActionIcon>
          )}
          {!isDesktop && isProfileOpen ? (
            <Text fw={600} size="lg">Profile</Text>
          ) : (
            <Text fw={700} size="lg" c="blue">Sahyog</Text>
          )}
        </Group>
        <Group gap={6}>
          {!isDesktop && isProfileOpen ? (
            /* Close button for profile — navigates back */
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
                <Avatar size={28} radius="xl" color="blue"><IconUser size={16} /></Avatar>
              </ActionIcon>
            </>
          )}
        </Group>
      </Box>

      <Box style={{ display: 'flex', flex: 1 }}>
        {/* ── Desktop Sidebar ── */}
        {showSidebar && (
          <Box component="nav" style={{
            width: SIDEBAR_W, flexShrink: 0,
            borderRight: '1px solid var(--mantine-color-default-border)',
            backgroundColor: 'var(--mantine-color-body)',
            position: 'fixed', top: HEADER_H, bottom: 0, left: 0, paddingTop: 8, zIndex: 99,
          }}>
            {SIDEBAR_NAV.map((item) => (
              <NavLink key={item.path} label={item.label} leftSection={<item.icon size={20} />}
                active={activePath === item.path} onClick={() => navigate(item.path)}
                variant="filled" style={{ borderRadius: 0 }} />
            ))}
          </Box>
        )}

        {/* ── Main Content ── */}
        <Box component="main" style={{
          flex: 1,
          marginLeft: showSidebar ? SIDEBAR_W : 0,
          paddingBottom: isDesktop ? 16 : (isProfileOpen ? 16 : BOTTOM_H + 16),
          paddingTop: 16, paddingLeft: 16, paddingRight: 16,
          maxWidth: isDesktop ? undefined : 1024,
          marginInline: isDesktop ? undefined : 'auto',
          width: '100%', boxSizing: 'border-box',
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
          {BOTTOM_NAV.map((item) => {
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
                  gap: 3,
                  minHeight: 44,
                  backgroundColor: active ? 'var(--mantine-color-blue-light)' : undefined,
                  transition: 'background-color 0.15s ease',
                }}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  size={24}
                  color={active ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-dimmed)'}
                />
                <Text
                  size="11px"
                  c={active ? 'blue' : 'dimmed'}
                  fw={active ? 700 : 400}
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
              <Card key={n.id} padding="sm" withBorder
                style={{ backgroundColor: n.is_read ? undefined : 'var(--mantine-color-blue-light)' }}>
                <Text size="sm" fw={600}>{n.title}</Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {parseActionTokens(n.message).map((part, i) =>
                    part.type === 'text' ? <span key={i}>{part.content}</span> :
                    <Text key={i} component={Link} to={part.path} size="xs" c="blue" style={{ cursor: 'pointer' }}>View</Text>
                  )}
                </Text>
                <Group justify="space-between" mt="xs">
                  <Text size="xs" c="dimmed">
                    {n.create_date ? formatDistanceToNow(parseISO(n.create_date), { addSuffix: true }) : ''}
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
