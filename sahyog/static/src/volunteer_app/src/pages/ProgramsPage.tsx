import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Badge,
  Text,
  SimpleGrid,
  Alert,
  Group,
  TextInput,
  Button,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconBooks,
  IconMapPin,
  IconCalendarEvent,
  IconClock,
  IconRepeat,
  IconSearch,
} from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { apiGet } from '../api';
import { PROGRAM_TYPE_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { IconTile } from '../components/IconTile';
import { CardSkeleton } from '../components/CardSkeleton';

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
    <Box style={{ maxWidth: isWide ? 1100 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <TextInput
        placeholder="Search programs..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        size="sm"
        mb="md"
        style={{ maxWidth: isWide ? 420 : undefined }}
      />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">{error}</Alert>
      )}

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} leading="tile" />)}
        </SimpleGrid>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={IconCalendarEvent}
          title={search ? 'No programs found' : 'Nothing scheduled yet'}
          description={search ? 'No programs match your search. Try a different name or location.' : 'Upcoming programs open to volunteers will appear here.'}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {filtered.map((s, idx) => (
            <Card
              key={s.id}
              padding="sm"
              withBorder
              shadow="xs"
              className="sahyog-fade-up"
              style={{ '--stagger': idx } as CSSProperties}
            >
              <Group wrap="nowrap" align="flex-start" gap="sm">
                <IconTile icon={IconBooks} color={PROGRAM_TYPE_COLOR[s.program_type] || 'sage'} />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" mb={4} wrap="wrap" gap={4}>
                    <Text ff="heading" fw={600} size="md" lh={1.25}>{s.program_name}</Text>
                    <Group gap={4}>
                      {s.is_recurring && (
                        <Badge size="xs" variant="light" color="river" leftSection={<IconRepeat size={10} />}>Recurring</Badge>
                      )}
                      <Badge size="xs" variant="light" color={PROGRAM_TYPE_COLOR[s.program_type] || 'sand'}>{s.program_type}</Badge>
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
                </Box>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
