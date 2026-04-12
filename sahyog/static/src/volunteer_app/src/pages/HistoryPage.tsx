import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  SegmentedControl,
  Card,
  Badge,
  Text,
  Spoiler,
  ActionIcon,
  Stack,
  Skeleton,
  Alert,
  Modal,
  Button,
  Group,
  Center,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconTrash, IconMoodEmpty, IconAlertCircle, IconX, IconCheck } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { apiGet, apiPost } from '../api';
import type {
  SilencePeriod,
  BreakPeriod,
  ProgramEnrollment,
  UnavailabilitySlot,
} from '../types';

type FilterType = 'all' | 'programs' | 'breaks' | 'silence' | 'unavailability';

const TYPE_COLORS: Record<string, string> = {
  silence: '#4A90D9',
  break: '#E8943A',
  program: '#5CB85C',
  unavailability: '#868E96',
};

const SILENCE_LABELS: Record<string, string> = {
  personal: 'Personal Silence',
  '9pm_9am': '9PM–9AM Silence',
  program: 'Program Silence',
};

const BREAK_LABELS: Record<string, string> = {
  personal: 'Personal Break',
  health: 'Health Break',
  family_emergency: 'Family Emergency',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved',
  on_going: 'On Going',
  done: 'Done',
  cancelled: 'Cancelled',
  pending_admin: 'Pending Approval',
  pending_volunteer: 'Pending Confirmation',
  upcoming: 'Upcoming',
  dropped: 'Dropped',
  completed: 'Completed',
};

const STATUS_COLORS: Record<string, string> = {
  requested: 'yellow',
  approved: 'green',
  on_going: 'blue',
  done: 'gray',
  cancelled: 'red',
  pending_admin: 'orange',
  pending_volunteer: 'orange',
  upcoming: 'cyan',
  dropped: 'red',
  completed: 'gray',
};

// Statuses that allow cancellation
const CANCELLABLE_SILENCE_BREAK = new Set(['requested', 'pending_admin', 'approved']);
const CANCELLABLE_PROGRAM = new Set(['pending_admin', 'upcoming']);

function fmtDate(d: string) {
  try {
    return format(parseISO(d), 'MMM d, yyyy');
  } catch {
    return d;
  }
}

interface UnifiedEntry {
  id: string;
  numericId: number;
  type: 'silence' | 'break' | 'program' | 'unavailability';
  sortDate: string;
  data: SilencePeriod | BreakPeriod | ProgramEnrollment | UnavailabilitySlot;
}

export function HistoryPage() {
  const [searchParams] = useSearchParams();
  const isWide = useMediaQuery('(min-width: 768px)');

  const initialFilter = (searchParams.get('filter') as FilterType) || 'all';
  const [filter, setFilter] = useState<FilterType>(initialFilter);

  const [silences, setSilences] = useState<SilencePeriod[]>([]);
  const [breaks, setBreaks] = useState<BreakPeriod[]>([]);
  const [programs, setPrograms] = useState<ProgramEnrollment[]>([]);
  const [unavailability, setUnavailability] = useState<UnavailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Cancel state
  const [cancelTarget, setCancelTarget] = useState<{ id: number; type: 'silence' | 'break' | 'program' } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Accept/Reject state
  const [respondTarget, setRespondTarget] = useState<{ id: number; type: 'silence' | 'break' | 'program'; action: 'accept' | 'reject' } | null>(null);
  const [responding, setResponding] = useState(false);

  const fetchAll = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<SilencePeriod[]>('/silence'),
      apiGet<BreakPeriod[]>('/breaks'),
      apiGet<ProgramEnrollment[]>('/programs'),
      apiGet<UnavailabilitySlot[]>('/unavailability'),
    ])
      .then(([s, b, p, u]) => {
        setSilences(s);
        setBreaks(b);
        setPrograms(p);
        setUnavailability(u);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const entries = useMemo<UnifiedEntry[]>(() => {
    const all: UnifiedEntry[] = [];
    silences.forEach((s) =>
      all.push({ id: `s-${s.id}`, numericId: s.id, type: 'silence', sortDate: s.start_date, data: s }),
    );
    breaks.forEach((b) =>
      all.push({ id: `b-${b.id}`, numericId: b.id, type: 'break', sortDate: b.start_date, data: b }),
    );
    programs.forEach((p) =>
      all.push({ id: `p-${p.id}`, numericId: p.id, type: 'program', sortDate: p.start_date, data: p }),
    );
    unavailability.forEach((u) =>
      all.push({ id: `u-${u.id}`, numericId: u.id, type: 'unavailability', sortDate: u.date, data: u }),
    );
    all.sort((a, b) => (a.sortDate > b.sortDate ? -1 : 1));
    return all;
  }, [silences, breaks, programs, unavailability]);

  const filtered = useMemo(() => {
    if (filter === 'all') return entries;
    const typeMap: Record<string, string> = {
      programs: 'program',
      breaks: 'break',
      silence: 'silence',
      unavailability: 'unavailability',
    };
    return entries.filter((e) => e.type === typeMap[filter]);
  }, [entries, filter]);

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    setDeleting(true);
    try {
      await apiPost('/unavailability/delete', { slot_id: deleteTarget });
      setUnavailability((prev) => prev.filter((u) => u.id !== deleteTarget));
      notifications.show({
        title: 'Deleted',
        message: 'Unavailability slot removed.',
        color: 'green',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete';
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const endpointMap: Record<string, string> = {
        silence: '/silence/cancel',
        break: '/breaks/cancel',
        program: '/programs/cancel',
      };
      await apiPost(endpointMap[cancelTarget.type], { id: cancelTarget.id });
      notifications.show({
        title: 'Cancelled',
        message: 'Entry has been cancelled.',
        color: 'green',
      });
      fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel';
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const handleRespond = async () => {
    if (!respondTarget) return;
    setResponding(true);
    try {
      const endpointMap: Record<string, Record<string, string>> = {
        silence: { accept: '/silence/accept', reject: '/silence/reject' },
        break: { accept: '/breaks/accept', reject: '/breaks/reject' },
        program: { accept: '/programs/accept', reject: '/programs/reject' },
      };
      await apiPost(endpointMap[respondTarget.type][respondTarget.action], { id: respondTarget.id });
      notifications.show({
        title: respondTarget.action === 'accept' ? 'Accepted' : 'Rejected',
        message: `Entry has been ${respondTarget.action === 'accept' ? 'accepted' : 'rejected'}.`,
        color: respondTarget.action === 'accept' ? 'green' : 'orange',
      });
      fetchAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed';
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setResponding(false);
      setRespondTarget(null);
    }
  };

  function isCancellable(type: 'silence' | 'break' | 'program', status: string): boolean {
    if (type === 'program') return CANCELLABLE_PROGRAM.has(status);
    return CANCELLABLE_SILENCE_BREAK.has(status);
  }

  return (
    <Box style={{ maxWidth: isWide ? 700 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <SegmentedControl
        fullWidth
        value={filter}
        onChange={(v) => setFilter(v as FilterType)}
        data={[
          { label: 'All', value: 'all' },
          { label: 'Programs', value: 'programs' },
          { label: 'Breaks', value: 'breaks' },
          { label: 'Silence', value: 'silence' },
          { label: 'Unavailability', value: 'unavailability' },
        ]}
        size="xs"
        mb="lg"
      />

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack gap="sm">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={80} radius="md" />
          ))}
        </Stack>
      ) : filtered.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="xs">
            <IconMoodEmpty size={48} color="var(--mantine-color-gray-4)" />
            <Text c="dimmed">No entries yet</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="sm">
          {filtered.map((entry) => {
            if (entry.type === 'unavailability') {
              const u = entry.data as UnavailabilitySlot;
              return (
                <Card
                  key={entry.id}
                  padding="sm"
                  withBorder
                  style={{ borderLeft: `4px solid ${TYPE_COLORS.unavailability}` }}
                >
                  <Group justify="space-between" align="flex-start">
                    <Box>
                      <Badge
                        size="xs"
                        style={{
                          backgroundColor: TYPE_COLORS.unavailability,
                          color: '#fff',
                        }}
                      >
                        unavailability
                      </Badge>
                      <Text size="sm" fw={600} mt={4}>
                        {u.reason || 'Unavailable'}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {fmtDate(u.date)} · {u.start_time} – {u.end_time}
                      </Text>
                    </Box>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      aria-label="Delete unavailability"
                      onClick={() => setDeleteTarget(u.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Card>
              );
            }

            // Silence / Break / Program cards
            let subtype = '';
            let status = '';
            let dateRange = '';
            let entryNotes = '';
            const color = TYPE_COLORS[entry.type];

            let isRecurring = false;
            let timeWindow = '';

            if (entry.type === 'silence') {
              const s = entry.data as SilencePeriod;
              subtype = SILENCE_LABELS[s.silence_type] || s.silence_type;
              status = s.status;
              dateRange = `${fmtDate(s.start_date)} → ${fmtDate(s.end_date)}`;
              entryNotes = s.notes;
              isRecurring = s.is_recurring;
              if (s.is_recurring && s.start_time && s.end_time) {
                timeWindow = `${s.start_time} – ${s.end_time}`;
              }
            } else if (entry.type === 'break') {
              const b = entry.data as BreakPeriod;
              subtype = BREAK_LABELS[b.break_type] || b.break_type;
              status = b.status;
              dateRange = `${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}`;
              entryNotes = b.notes;
              isRecurring = b.is_recurring;
              if (b.is_recurring && b.start_time && b.end_time) {
                timeWindow = `${b.start_time} – ${b.end_time}`;
              }
            } else {
              const p = entry.data as ProgramEnrollment;
              subtype = p.program_name;
              status = p.completion_status;
              dateRange = `${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}`;
              entryNotes = p.notes;
            }

            const canCancel = isCancellable(entry.type as 'silence' | 'break' | 'program', status);

            return (
              <Card
                key={entry.id}
                padding="sm"
                withBorder
                shadow="xs"
                style={{ borderLeft: `4px solid ${color}` }}
              >
                <Group justify="space-between" mb={4}>
                  <Badge
                    size="xs"
                    style={{ backgroundColor: color, color: '#fff' }}
                  >
                    {entry.type}
                  </Badge>
                  {status && (
                    <Badge size="xs" variant="light" color={STATUS_COLORS[status] || 'gray'}>
                      {STATUS_LABELS[status] || status}
                    </Badge>
                  )}
                </Group>
                <Text size="sm" fw={600}>
                  {subtype}
                </Text>
                <Text size="xs" c="dimmed">
                  {dateRange}
                </Text>
                {isRecurring && (
                  <Badge color="violet" size="sm" mt={4}>
                    Recurring
                  </Badge>
                )}
                {isRecurring && timeWindow && (
                  <Text size="sm" c="dimmed">
                    {timeWindow}
                  </Text>
                )}
                {entryNotes ? (
                  <Spoiler
                    maxHeight={0}
                    showLabel="Show more"
                    hideLabel="Show less"
                    mt={4}
                  >
                    <Text size="xs" c="dimmed">
                      {entryNotes}
                    </Text>
                  </Spoiler>
                ) : null}
                {canCancel && (
                  <Group justify="flex-end" mt="xs">
                    <Button
                      variant="subtle"
                      color="red"
                      size="compact-xs"
                      leftSection={<IconX size={14} />}
                      onClick={() => setCancelTarget({ id: entry.numericId, type: entry.type as 'silence' | 'break' | 'program' })}
                    >
                      Cancel
                    </Button>
                  </Group>
                )}
                {status === 'pending_volunteer' && (
                  <Group justify="flex-end" mt="xs" gap="xs">
                    <Button
                      variant="light"
                      color="green"
                      size="compact-xs"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => setRespondTarget({ id: entry.numericId, type: entry.type as 'silence' | 'break' | 'program', action: 'accept' })}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="light"
                      color="red"
                      size="compact-xs"
                      leftSection={<IconX size={14} />}
                      onClick={() => setRespondTarget({ id: entry.numericId, type: entry.type as 'silence' | 'break' | 'program', action: 'reject' })}
                    >
                      Reject
                    </Button>
                  </Group>
                )}
              </Card>
            );
          })}
        </Stack>
      )}

      {/* Delete confirmation modal */}
      <Modal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Delete"
        centered
        size="sm"
      >
        <Text size="sm">
          Are you sure you want to delete this unavailability slot?
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button color="red" loading={deleting} onClick={handleDelete}>
            Delete
          </Button>
        </Group>
      </Modal>

      {/* Cancel confirmation modal */}
      <Modal
        opened={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Confirm Cancellation"
        centered
        size="sm"
      >
        <Text size="sm">
          Are you sure you want to cancel this {cancelTarget?.type} entry?
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setCancelTarget(null)}>
            No, Keep It
          </Button>
          <Button color="red" loading={cancelling} onClick={handleCancel}>
            Yes, Cancel
          </Button>
        </Group>
      </Modal>

      {/* Accept/Reject confirmation modal */}
      <Modal
        opened={respondTarget !== null}
        onClose={() => setRespondTarget(null)}
        title={respondTarget?.action === 'accept' ? 'Confirm Accept' : 'Confirm Reject'}
        centered
        size="sm"
      >
        <Text size="sm">
          {respondTarget?.action === 'accept'
            ? `Accept this ${respondTarget?.type} entry?`
            : `Reject this ${respondTarget?.type} entry? This cannot be undone.`}
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setRespondTarget(null)}>
            Go Back
          </Button>
          <Button
            color={respondTarget?.action === 'accept' ? 'green' : 'red'}
            loading={responding}
            onClick={handleRespond}
          >
            {respondTarget?.action === 'accept' ? 'Accept' : 'Reject'}
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
