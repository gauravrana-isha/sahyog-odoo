import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Badge,
  Text,
  Stack,
  Skeleton,
  Alert,
  Center,
  Group,
  TextInput,
  Affix,
  ActionIcon,
} from '@mantine/core';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconMoodEmpty,
  IconCalendarEvent,
  IconSearch,
  IconPlus,
} from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { apiGet } from '../api';
import type { GuestVisit } from '../types';
import { QuickCreateModal } from '../components/QuickCreateModal';

function fmtDate(d: string) {
  try { return format(parseISO(d), 'MMM d, yyyy'); }
  catch { return d; }
}

export function GuestsPage() {
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [visits, setVisits] = useState<GuestVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  const fetchVisits = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<GuestVisit[]>('/guest-visits')
      .then((data) => setVisits(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const filtered = useMemo(() => {
    if (!search.trim()) return visits;
    const q = search.toLowerCase();
    return visits.filter((v) =>
      v.main_guest_name.toLowerCase().includes(q)
    );
  }, [visits, search]);

  return (
    <Box style={{ maxWidth: isWide ? 700 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <Text fw={600} size="lg" mb="sm">Guest Visits</Text>

      <TextInput
        placeholder="Search by guest name..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        size="sm"
        mb="md"
      />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{error}</Alert>
      )}

      {loading ? (
        <Stack gap="sm">
          {[1, 2, 3].map((i) => <Skeleton key={i} height={90} radius="md" />)}
        </Stack>
      ) : filtered.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <IconMoodEmpty size={48} color="var(--mantine-color-gray-4)" />
            <Text c="dimmed">{search ? 'No guests match your search' : 'No guest visits yet'}</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="sm">
          {filtered.map((v) => (
            <Card
              key={v.id}
              padding="sm"
              withBorder
              shadow="xs"
              style={{ borderLeft: '4px solid #E67E22', cursor: 'pointer' }}
              onClick={() => navigate(`/guests/${v.id}`)}
            >
              <Group justify="space-between" mb={4} wrap="wrap">
                <Text size="sm" fw={600}>{v.main_guest_name}</Text>
                <Group gap={4}>
                  <Badge size="xs" variant="light" color={v.state === 'complete' ? 'green' : 'orange'}>
                    {v.state}
                  </Badge>
                  {v.feedback_count > 0 && (
                    <Badge size="xs" variant="light" color="blue">
                      {v.feedback_count} feedback
                    </Badge>
                  )}
                </Group>
              </Group>

              {(v.arrival_date || v.departure_date) && (
                <Group gap="xs">
                  <IconCalendarEvent size={14} color="var(--mantine-color-gray-5)" />
                  <Text size="xs" c="dimmed">
                    {v.arrival_date ? fmtDate(v.arrival_date) : '—'} → {v.departure_date ? fmtDate(v.departure_date) : '—'}
                  </Text>
                </Group>
              )}
            </Card>
          ))}
        </Stack>
      )}

      <Affix position={{ bottom: 24, right: 24 }}>
        <ActionIcon size="xl" radius="xl" variant="filled" color="blue" onClick={openModal} aria-label="Add guest">
          <IconPlus size={24} />
        </ActionIcon>
      </Affix>

      <QuickCreateModal opened={modalOpened} onClose={closeModal} onCreated={fetchVisits} />
    </Box>
  );
}
