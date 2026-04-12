import { useState, useEffect, useCallback } from 'react';
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
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconMoodEmpty,
  IconMapPin,
  IconCalendarEvent,
  IconClock,
  IconRepeat,
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
  silence: 'violet',
  other: 'gray',
};

function fmtDate(d: string) {
  try {
    return format(parseISO(d), 'MMM d, yyyy');
  } catch {
    return d;
  }
}

export function ProgramsPage() {
  const isWide = useMediaQuery('(min-width: 768px)');
  const [schedules, setSchedules] = useState<UpcomingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<UpcomingSchedule[]>('/schedules/upcoming')
      .then((data) => setSchedules(data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  return (
    <Box style={{ maxWidth: isWide ? 700 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <Text fw={600} size="lg" mb="md">
        Upcoming Programs
      </Text>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack gap="sm">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} height={90} radius="md" />
          ))}
        </Stack>
      ) : schedules.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <IconMoodEmpty size={48} color="var(--mantine-color-gray-4)" />
            <Text c="dimmed">No upcoming programs scheduled</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="sm">
          {schedules.map((s) => (
            <Card
              key={s.id}
              padding="sm"
              withBorder
              shadow="xs"
              style={{ borderLeft: '4px solid #5CB85C' }}
            >
              {/* Header: program name + type badge + recurring badge */}
              <Group justify="space-between" mb={4} wrap="wrap">
                <Text size="sm" fw={600}>{s.program_name}</Text>
                <Group gap={4}>
                  {s.is_recurring && (
                    <Badge size="xs" variant="light" color="violet" leftSection={<IconRepeat size={10} />}>
                      Recurring
                    </Badge>
                  )}
                  <Badge size="xs" variant="light" color={TYPE_COLORS[s.program_type] || 'gray'}>
                    {s.program_type}
                  </Badge>
                </Group>
              </Group>

              {/* Dates */}
              <Group gap="xs">
                <IconCalendarEvent size={14} color="var(--mantine-color-gray-5)" />
                <Text size="xs" c="dimmed">
                  {fmtDate(s.start_date)} → {fmtDate(s.end_date)}
                </Text>
              </Group>

              {/* Time window — shown for recurring or when times are set */}
              {s.start_time && s.end_time && (
                <Group gap="xs" mt={2}>
                  <IconClock size={14} color="var(--mantine-color-gray-5)" />
                  <Text size="xs" c="dimmed">
                    {s.start_time} – {s.end_time}
                  </Text>
                </Group>
              )}

              {/* Location */}
              {s.location && (
                <Group gap="xs" mt={2}>
                  <IconMapPin size={14} color="var(--mantine-color-gray-5)" />
                  <Text size="xs" c="dimmed">{s.location}</Text>
                </Group>
              )}

              {/* Capacity + Fee row */}
              {(s.capacity > 0 || s.fee) && (
                <Group gap="md" mt={4}>
                  {s.capacity > 0 && (
                    <Text size="xs" c="dimmed">Capacity: {s.capacity}</Text>
                  )}
                  {s.fee && (
                    <Text size="xs" c="dimmed">Fee: {s.fee}</Text>
                  )}
                </Group>
              )}

              {/* Notes */}
              {s.notes && (
                <Text size="xs" c="dimmed" mt={4}>{s.notes}</Text>
              )}
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
