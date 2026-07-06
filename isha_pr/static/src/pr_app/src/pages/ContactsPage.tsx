import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextInput, Stack, Card, Text, Group, Badge, Button, Modal, Select, SimpleGrid, Avatar, Box,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconPlus, IconAddressBook, IconMapPin, IconChevronRight } from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import { usePR } from '../hooks/usePR';
import { VIP_COLOR, INVOLVEMENT_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/CardSkeleton';
import type { Contact } from '../types';

export function ContactsPage() {
  const [q, setQ] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { me } = usePR();
  const isWide = useMediaQuery('(min-width: 768px)');

  const load = useCallback((search: string, region: string | null) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (region) params.set('region_id', region);
    const qs = params.toString();
    apiGet<Contact[]>(`/contacts${qs ? `?${qs}` : ''}`)
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, regionId), 250);
    return () => clearTimeout(t);
  }, [q, regionId, load]);

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const c = await apiPost<Contact>('/contacts/create', form);
      close();
      setForm({ name: '', email: '', phone: '' });
      navigate(`/contacts/${c.id}`);
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const regionSelect = (
    <Select
      w={isWide ? 210 : '100%'}
      leftSection={<IconMapPin size={16} />}
      placeholder="All regions"
      aria-label="Filter by region"
      data={(me?.regions ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
      value={regionId}
      onChange={setRegionId}
      clearable
      searchable
    />
  );

  return (
    <Box style={{ maxWidth: isWide ? 1100 : undefined, margin: isWide ? '0 auto' : undefined }}>
    <Stack>
      <Group wrap="nowrap">
        <TextInput
          flex={1}
          leftSection={<IconSearch size={16} />}
          placeholder="Search contacts…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          style={{ maxWidth: isWide ? 420 : undefined }}
        />
        {isWide && regionSelect}
        <Button leftSection={<IconPlus size={16} />} onClick={open}>
          New
        </Button>
      </Group>
      {!isWide && regionSelect}

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} leading="avatar" />)}
        </SimpleGrid>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={IconAddressBook}
          title={q || regionId ? 'No contacts found' : 'No contacts yet'}
          description={q || regionId ? 'No contacts match your search or region filter.' : 'Tap "New" to add your first PR contact.'}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {contacts.map((c, idx) => (
          <Card key={c.id} withBorder padding="sm" shadow="xs"
            className="sahyog-fade-up sahyog-card-interactive"
            style={{ cursor: 'pointer', '--stagger': idx } as CSSProperties}
            onClick={() => navigate(`/contacts/${c.id}`)}>
            <Group wrap="nowrap" gap="sm">
              <Avatar src={c.image_url} radius="xl" color="clay" size={38}>
                {c.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </Avatar>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group justify="space-between" wrap="wrap" gap={4}>
                  <Group gap={6}>
                    <Text ff="heading" fw={600} size="md" lh={1.25}>{c.name}</Text>
                    {c.vip && <Badge size="xs" variant="light" color={VIP_COLOR}>VIP</Badge>}
                  </Group>
                  <Group gap={4}>
                    {c.pr_involvement &&
                      <Badge size="xs" variant="light" color={INVOLVEMENT_COLOR}>{c.pr_involvement}</Badge>}
                    {c.interaction_count > 0 &&
                      <Badge size="xs" variant="light">{c.interaction_count}</Badge>}
                  </Group>
                </Group>
                <Text size="xs" c="dimmed" mt={2} truncate>{c.email || c.phone || '—'}</Text>
              </Box>
              <IconChevronRight size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
            </Group>
          </Card>
        ))}
        </SimpleGrid>
      )}

      <Modal opened={opened} onClose={close} title="New PR contact">
        <Stack>
          <TextInput label="Name" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <TextInput label="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} />
          <TextInput label="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} />
          <Button loading={saving} onClick={create}>Create</Button>
        </Stack>
      </Modal>
    </Stack>
    </Box>
  );
}
