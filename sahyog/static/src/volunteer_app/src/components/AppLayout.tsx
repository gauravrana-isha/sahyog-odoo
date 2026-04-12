import { type ReactNode, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Text,
  UnstyledButton,
  Stack,
  ActionIcon,
  Indicator,
  Drawer,
  Card,
  Group,
  Button,
  Center,
  Loader,
  NavLink,
} from '@mantine/core';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconHistory,
  IconCalendar,
  IconUser,
  IconBell,
  IconCheck,
  IconMenu2,
  IconLayoutSidebarLeftCollapse,
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

const NAV_ITEMS = [
  { label: 'Request', icon: IconPlus, path: '/' },
  { label: 'History', icon: IconHistory, path: '/history' },
  { label: 'Calendar', icon: IconCalendar, path: '/calendar' },
  { label: 'Profile', icon: IconUser, path: '/profile' },
] as const;

const HEADER_H = 56;
const BOTTOM_H = 56;
const SIDEBAR_W = 280;

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [sidebarOpen, { toggle: toggleSidebar }] = useDisclosure(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  // Poll unread count
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

  // Fetch notifications when drawer opens
  const fetchNotifications = useCallback(() => {
    setNotifLoading(true);
    apiGet<Notification[]>('/notifications')
      .then((data) => setNotifications(data))
      .catch(() => {})
      .finally(() => setNotifLoading(false));
  }, []);

  useEffect(() => {
    if (drawerOpen) fetchNotifications();
  }, [drawerOpen, fetchNotifications]);

  const markRead = async (id: number) => {
    try {
      await apiPost('/notifications/read', { notification_id: id });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      const result = await apiGet<{ count: number }>('/notifications/unread-count');
      setUnreadCount(result.count);
    } catch {
      // silent
    }
  };

  const activePath = location.pathname;
  const showSidebar = isDesktop && sidebarOpen;

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header — full width */}
      <Box
        component="header"
        style={{
          height: HEADER_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 16,
          paddingRight: 16,
          backgroundColor: '#fff',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
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
          <Text fw={600} size="lg" c="blue">
            Sahyog
          </Text>
        </Group>
        <ActionIcon
          variant="subtle"
          size="lg"
          aria-label="Notifications"
          onClick={() => setDrawerOpen(true)}
          style={{ overflow: 'visible' }}
        >
          <Indicator
            disabled={unreadCount === 0}
            label={unreadCount > 99 ? '99+' : String(unreadCount)}
            size={20}
            color="red"
            offset={2}
            styles={{ indicator: { padding: '0 4px', minWidth: 20, height: 20, fontSize: 11 } }}
          >
            <IconBell size={22} />
          </Indicator>
        </ActionIcon>
      </Box>

      <Box style={{ display: 'flex', flex: 1 }}>
        {/* Desktop Sidebar */}
        {showSidebar && (
          <Box
            component="nav"
            style={{
              width: SIDEBAR_W,
              flexShrink: 0,
              borderRight: '1px solid var(--mantine-color-gray-2)',
              backgroundColor: '#fff',
              position: 'fixed',
              top: HEADER_H,
              bottom: 0,
              left: 0,
              paddingTop: 8,
              zIndex: 99,
            }}
          >
            {NAV_ITEMS.map((item) => {
              const active = activePath === item.path;
              return (
                <NavLink
                  key={item.path}
                  label={item.label}
                  leftSection={<item.icon size={20} />}
                  active={active}
                  onClick={() => navigate(item.path)}
                  variant="filled"
                  style={{ borderRadius: 0 }}
                />
              );
            })}
          </Box>
        )}

        {/* Main Content */}
        <Box
          component="main"
          style={{
            flex: 1,
            marginLeft: showSidebar ? SIDEBAR_W : 0,
            paddingBottom: isDesktop ? 16 : BOTTOM_H + 16,
            paddingTop: 16,
            paddingLeft: 16,
            paddingRight: 16,
            maxWidth: isDesktop ? undefined : 1024,
            marginInline: isDesktop ? undefined : 'auto',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          {children}
        </Box>
      </Box>

      {/* Mobile/Tablet Bottom Tab Bar */}
      {!isDesktop && (
        <Box
          component="nav"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: BOTTOM_H,
            backgroundColor: '#fff',
            borderTop: '1px solid var(--mantine-color-gray-2)',
            display: 'flex',
            zIndex: 100,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = activePath === item.path;
            const Icon = item.icon;
            return (
              <UnstyledButton
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: 44,
                }}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
              >
                <Stack align="center" gap={2}>
                  <Icon
                    size={22}
                    color={
                      active
                        ? 'var(--mantine-color-blue-6)'
                        : 'var(--mantine-color-gray-5)'
                    }
                  />
                  <Text
                    size="xs"
                    c={active ? 'blue.6' : 'gray.5'}
                    fw={active ? 600 : 400}
                  >
                    {item.label}
                  </Text>
                </Stack>
              </UnstyledButton>
            );
          })}
        </Box>
      )}

      {/* Notification Drawer */}
      <Drawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        position="right"
        size={isDesktop ? 360 : '100%'}
        title={<Text fw={600} size="lg">Notifications</Text>}
      >
        {notifLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : notifications.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconCheck size={40} color="var(--mantine-color-green-5)" />
              <Text c="dimmed">All caught up</Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap="xs">
            {notifications.map((n) => (
              <Card
                key={n.id}
                padding="sm"
                withBorder
                style={{
                  backgroundColor: n.is_read
                    ? '#fff'
                    : 'var(--mantine-color-blue-0)',
                }}
              >
                <Text size="sm" fw={600}>
                  {n.title}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {parseActionTokens(n.message).map((part, i) =>
                    part.type === 'text' ? (
                      <span key={i}>{part.content}</span>
                    ) : (
                      <Text key={i} component={Link} to={part.path} size="xs" c="blue" style={{ cursor: 'pointer' }}>
                        View
                      </Text>
                    ),
                  )}
                </Text>
                <Group justify="space-between" mt="xs">
                  <Text size="xs" c="dimmed">
                    {n.create_date
                      ? formatDistanceToNow(parseISO(n.create_date), {
                          addSuffix: true,
                        })
                      : ''}
                  </Text>
                  {!n.is_read && (
                    <Button
                      variant="subtle"
                      size="compact-xs"
                      onClick={() => markRead(n.id)}
                    >
                      Mark as Read
                    </Button>
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
