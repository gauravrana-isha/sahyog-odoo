import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon, Badge, Button, Card, Center, Drawer, Group, Indicator,
  Loader, Stack, Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconBell, IconCheck, IconX } from '@tabler/icons-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { apiGet, apiPost } from '../api';
import type { PRNotification } from '../types';

function timeAgo(d: string) {
  try {
    return formatDistanceToNow(parseISO(d.endsWith('Z') ? d : `${d}Z`), { addSuffix: true });
  } catch {
    return '';
  }
}

/** Header bell with unread badge + slide-in notification drawer. */
export function NotificationBell() {
  const navigate = useNavigate();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [opened, setOpened] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<PRNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnread = useCallback(() => {
    apiGet<{ count: number }>('/notifications/unread-count')
      .then((r) => setUnread(r.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  useEffect(() => {
    if (!opened) return;
    setLoading(true);
    apiGet<PRNotification[]>('/notifications')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [opened]);

  const markRead = async (id: number) => {
    try {
      await apiPost('/notifications/read', { notification_id: id });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      fetchUnread();
    } catch { /* silent */ }
  };

  const markAllRead = async () => {
    try {
      await apiPost('/notifications/read-all', {});
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch { /* silent */ }
  };

  const clearAll = async () => {
    try {
      await apiPost('/notifications/clear', {});
      setItems([]);
      setUnread(0);
    } catch { /* silent */ }
  };

  const remove = async (id: number) => {
    try {
      await apiPost('/notifications/delete', { notification_id: id });
      setItems((prev) => prev.filter((n) => n.id !== id));
      fetchUnread();
    } catch { /* silent */ }
  };

  const openNotification = (n: PRNotification) => {
    if (!n.is_read) markRead(n.id);
    if (n.path) {
      setOpened(false);
      navigate(n.path);
    }
  };

  return (
    <>
      <ActionIcon variant="subtle" size="lg" aria-label="Notifications"
        onClick={() => setOpened(true)} style={{ overflow: 'visible' }}>
        <Indicator disabled={unread === 0} label={unread > 99 ? '99+' : String(unread)}
          size={18} color="red" offset={2}
          styles={{ indicator: { padding: '0 4px', minWidth: 18, height: 18, fontSize: 10 } }}>
          <IconBell size={22} />
        </Indicator>
      </ActionIcon>

      <Drawer opened={opened} onClose={() => setOpened(false)} position="right"
        size={isDesktop ? 360 : '100%'} title={<Text fw={600} size="lg">Notifications</Text>}>
        {loading ? (
          <Center py="xl"><Loader size="sm" /></Center>
        ) : items.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="xs">
              <IconCheck size={40} color="var(--mantine-color-sage-5)" />
              <Text c="dimmed">All caught up</Text>
            </Stack>
          </Center>
        ) : (
          <Stack gap="xs">
            <Group justify="flex-end" gap="xs">
              <Button variant="subtle" size="compact-xs" onClick={markAllRead}>Mark All Read</Button>
              <Button variant="subtle" size="compact-xs" color="red" onClick={clearAll}>Clear All</Button>
            </Group>
            {items.map((n) => (
              <Card key={n.id} padding="sm" withBorder
                style={{
                  backgroundColor: n.is_read ? undefined : 'var(--mantine-color-clay-light)',
                  position: 'relative',
                  cursor: n.path ? 'pointer' : undefined,
                }}
                onClick={() => openNotification(n)}>
                <ActionIcon variant="subtle" size="xs" color="gray"
                  style={{ position: 'absolute', top: 6, right: 6 }}
                  onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                  aria-label="Delete notification">
                  <IconX size={14} />
                </ActionIcon>
                <Text size="sm" fw={600} pr={20}>{n.title}</Text>
                <Text size="xs" c="dimmed" mt={2}>{n.message}</Text>
                <Group justify="space-between" mt="xs">
                  <Text size="xs" c="dimmed">{timeAgo(n.create_date)}</Text>
                  <Group gap={6}>
                    {n.path && <Badge size="xs" variant="light" color="river">Open</Badge>}
                    {!n.is_read && (
                      <Button variant="subtle" size="compact-xs"
                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>
                        Mark as Read
                      </Button>
                    )}
                  </Group>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Drawer>
    </>
  );
}
