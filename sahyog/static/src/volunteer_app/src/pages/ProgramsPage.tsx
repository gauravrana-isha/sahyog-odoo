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
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconAlertCircle, IconMoodEmpty } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { apiGet } from '../api';
import type { ProgramEnrollment } from '../types';

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  pending_admin: 'Pending Approval',
  pending_volunteer: 'Pending Confirmation',
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: 'cyan',
  pending_admin: 'orange',
  pending_volunteer: 'orange',
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
  const [programs, setPrograms] = useState<ProgramEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrograms = useCallback(() => {
    setLoading(true);
    setError(null);
    apiGet<ProgramEnrollment[]>('/programs')
      .then((data) => {
        // Only show upcoming / pending programs
        const upcoming = data.filter(
          (p) => ['upcoming', 'pending_admin', 'pending_volunteer'].includes(p.completion_status),
        );
        setPrograms(upcoming);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

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
            <Skeleton key={i} height={80} radius="md" />
          ))}
        </Stack>
      ) : programs.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <IconMoodEmpty size={48} color="var(--mantine-color-gray-4)" />
            <Text c="dimmed">No upcoming programs</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="sm">
          {programs.map((p) => (
            <Card
              key={p.id}
              padding="sm"
              withBorder
              shadow="xs"
              style={{ borderLeft: '4px solid #5CB85C' }}
            >
              <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Badge size="xs" style={{ backgroundColor: '#5CB85C', color: '#fff' }}>
                  {p.participation_type}
                </Badge>
                <Badge size="xs" variant="light" color={STATUS_COLORS[p.completion_status] || 'gray'}>
                  {STATUS_LABELS[p.completion_status] || p.completion_status}
                </Badge>
              </Box>
              <Text size="sm" fw={600} mt={4}>
                {p.program_name}
              </Text>
              <Text size="xs" c="dimmed">
                {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
              </Text>
              {p.location && (
                <Text size="xs" c="dimmed">
                  {p.location}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
