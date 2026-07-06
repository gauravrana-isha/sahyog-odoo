import { useState, useEffect, useCallback, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Badge,
  Text,
  Avatar,
  SimpleGrid,
  Alert,
  Group,
  TextInput,
  Affix,
  ActionIcon,
} from '@mantine/core';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconUsers,
  IconCalendarEvent,
  IconChevronRight,
  IconSearch,
  IconPlus,
} from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { apiGet } from '../api';
import type { GuestVisit } from '../types';
import { GUEST_STATE_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/CardSkeleton';
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
    <Box style={{ maxWidth: isWide ? 1100 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <TextInput
        placeholder="Search by guest name..."
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
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} leading="avatar" />)}
        </SimpleGrid>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={IconUsers}
          title={search ? 'No guests found' : 'No guest visits yet'}
          description={search ? 'No guests match your search. Try a different name.' : 'Tap the + button to register your first guest visit.'}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {filtered.map((v, idx) => (
            <Card
              key={v.id}
              padding="sm"
              withBorder
              shadow="xs"
              className="sahyog-fade-up sahyog-card-interactive"
              style={{ cursor: 'pointer', '--stagger': idx } as CSSProperties}
              onClick={() => navigate(`/guests/${v.id}`)}
            >
              <Group wrap="nowrap" gap="sm">
                <Avatar radius="xl" color="clay" size={38}>
                  {v.main_guest_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </Avatar>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" wrap="wrap" gap={4}>
                    <Text ff="heading" fw={600} size="md" lh={1.25}>{v.main_guest_name}</Text>
                    <Group gap={4}>
                      <Badge size="xs" variant="light" color={GUEST_STATE_COLOR[v.state] || 'ochre'}>
                        {v.state}
                      </Badge>
                      {v.feedback_count > 0 && (
                        <Badge size="xs" variant="light" color="river">
                          {v.feedback_count} feedback
                        </Badge>
                      )}
                    </Group>
                  </Group>

                  {(v.arrival_date || v.departure_date) && (
                    <Group gap="xs" mt={2}>
                      <IconCalendarEvent size={14} color="var(--mantine-color-gray-5)" />
                      <Text size="xs" c="dimmed">
                        {v.arrival_date ? fmtDate(v.arrival_date) : '—'} → {v.departure_date ? fmtDate(v.departure_date) : '—'}
                      </Text>
                    </Group>
                  )}
                </Box>
                <IconChevronRight size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Affix position={{ bottom: isWide ? 24 : 88, right: 24 }}>
        <ActionIcon size="xl" radius="xl" variant="filled" onClick={openModal} aria-label="Add guest" style={{ boxShadow: 'var(--mantine-shadow-lg)' }}>
          <IconPlus size={24} />
        </ActionIcon>
      </Affix>

      <QuickCreateModal opened={modalOpened} onClose={closeModal} onCreated={fetchVisits} />
    </Box>
  );
}
