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
  Button,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconMoodEmpty,
  IconMapPin,
  IconCalendarEvent,
  IconClock,
  IconRepeat,
  IconSearch,
} from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { apiGet } from '../api';

interface UpcomingSchedule {
  id: number;
  program_id: number;
  program_name: string;
  program_type: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  location: string;
  capacity: number;
  fee: string;
  schedule_status: string;
  notes: string;
}

const TYPE_COLORS: Record<string, string> = {
  main: 'blue',
  hatha: 'teal',
  silence: 'violet',
  other: 'gray',
};

function fmtDate(d: string) {
  try { return format(parseISO(d), 'MMM d, yyyy'); }
  catch { return d; }
}

export function ProgramsPage() {
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [schedules, setSchedules] = useState<UpcomingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchSchedules = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<UpcomingSchedule[]>('/schedules/upcoming')
      .then((data) => setSchedules(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const filtered = useMemo(() => {
    if (!search.trim()) return schedules;
    const q = search.toLowerCase();
    return schedules.filter((s) =>
      s.program_name.toLowerCase().includes(q) ||
      (s.location && s.location.toLowerCase().includes(q))
    );
  }, [schedules, search]);

  return (
    <Box style={{ maxWidth: isWide ? 700 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <Group justify="space-between" align="center" mb="sm">
        <Text fw={600} size="lg">Upcoming Programs</Text>
        <Button
          component="a"
          href="https://docs.google.com/spreadsheets/d/1lOk_LZ1BYDazrWh0ZZxmis3thv_dnbNI/edit"
          target="_blank"
          variant="subtle"
          size="compact-sm"
          leftSection={<IconCalendarEvent size={16} />}
        >
          Schedule Sheet
        </Button>
      </Group>

      <TextInput
        placeholder="Search programs..."
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
            <Text c="dimmed">{search ? 'No programs match your search' : 'No upcoming programs scheduled'}</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="sm">
          {filtered.map((s) => (
            <Card key={s.id} padding="sm" withBorder shadow="xs" style={{ borderLeft: '4px solid #5CB85C' }}>
              <Group justify="space-between" mb={4} wrap="wrap">
                <Text size="sm" fw={600}>{s.program_name}</Text>
                <Group gap={4}>
                  {s.is_recurring && (
                    <Badge size="xs" variant="light" color="violet" leftSection={<IconRepeat size={10} />}>Recurring</Badge>
                  )}
                  <Badge size="xs" variant="light" color={TYPE_COLORS[s.program_type] || 'gray'}>{s.program_type}</Badge>
                </Group>
              </Group>

              <Group gap="xs">
                <IconCalendarEvent size={14} color="var(--mantine-color-gray-5)" />
                <Text size="xs" c="dimmed">{fmtDate(s.start_date)} → {fmtDate(s.end_date)}</Text>
              </Group>

              {s.start_time && s.end_time && (
                <Group gap="xs" mt={2}>
                  <IconClock size={14} color="var(--mantine-color-gray-5)" />
                  <Text size="xs" c="dimmed">{s.start_time} – {s.end_time}</Text>
                </Group>
              )}

              {s.location && (
                <Group gap="xs" mt={2}>
                  <IconMapPin size={14} color="var(--mantine-color-gray-5)" />
                  <Text size="xs" c="dimmed">{s.location}</Text>
                </Group>
              )}

              {(s.capacity > 0 || s.fee) && (
                <Group gap="md" mt={4}>
                  {s.capacity > 0 && <Text size="xs" c="dimmed">Capacity: {s.capacity}</Text>}
                  {s.fee && <Text size="xs" c="dimmed">Fee: {s.fee}</Text>}
                </Group>
              )}

              {s.notes && <Text size="xs" c="dimmed" mt={4}>{s.notes}</Text>}

              <Button
                variant="light"
                size="compact-xs"
                mt="xs"
                onClick={() => navigate(`/request?program_id=${s.program_id}&schedule_id=${s.id}`)}
              >
                Enroll
              </Button>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
