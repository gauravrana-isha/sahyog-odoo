import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextInput, Stack, Card, Text, Group, Badge, Button, Modal, Select,
  SimpleGrid, Avatar, Box, Table,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconAddressBook, IconMapPin } from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import { usePR } from '../hooks/usePR';
import { VIP_COLOR, INVOLVEMENT_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/CardSkeleton';
import { EntityCard } from '../components/EntityCard';
import { ListToolbar } from '../components/ListToolbar';
import type { Contact } from '../types';

const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'interactions', label: 'Most interactions' },
  { value: 'vip', label: 'VIP first' },
];

const GROUP_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'involvement', label: 'Involvement level' },
];

const INVOLVEMENT_ORDER = ['high', 'moderate', 'low', ''];
const INVOLVEMENT_LABELS: Record<string, string> = {
  high: 'High involvement',
  moderate: 'Moderate involvement',
  low: 'Low involvement',
  '': 'No involvement set',
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function ContactsPage() {
  const [q, setQ] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('name');
  const [groupBy, setGroupBy] = useState('none');
  const [view, setView] = useState('cards');
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

  const sorted = useMemo(() => {
    const arr = [...contacts];
    if (sort === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'interactions') arr.sort((a, b) => b.interaction_count - a.interaction_count);
    if (sort === 'vip') arr.sort((a, b) => Number(b.vip) - Number(a.vip) || a.name.localeCompare(b.name));
    return arr;
  }, [contacts, sort]);

  const groups = useMemo(() => {
    if (groupBy !== 'involvement') return [{ key: 'all', title: '', items: sorted }];
    return INVOLVEMENT_ORDER
      .map((level) => ({
        key: level || 'none',
        title: INVOLVEMENT_LABELS[level],
        items: sorted.filter((c) => (c.pr_involvement || '') === level),
      }))
      .filter((g) => g.items.length > 0);
  }, [sorted, groupBy]);

  const contactCard = (c: Contact, idx: number) => (
    <EntityCard
      key={c.id}
      stagger={idx}
      onClick={() => navigate(`/contacts/${c.id}`)}
      leading={
        <Avatar src={c.image_url} radius="xl" color="clay" size={38}>
          {initials(c.name)}
        </Avatar>
      }
      title={c.name}
      titleExtras={c.vip && <Badge size="xs" variant="light" color={VIP_COLOR}>VIP</Badge>}
      badges={
        <>
          {c.pr_involvement &&
            <Badge size="xs" variant="light" color={INVOLVEMENT_COLOR}>{c.pr_involvement}</Badge>}
          {c.interaction_count > 0 &&
            <Badge size="xs" variant="light">{c.interaction_count}</Badge>}
        </>
      }
      meta={<Text size="xs" c="dimmed" mt={2} truncate>{c.email || c.phone || '—'}</Text>}
    />
  );

  const contactsTable = (items: Contact[]) => (
    <Card withBorder padding={0} className="sahyog-fade-up">
      <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Contact</Table.Th>
            <Table.Th>Involvement</Table.Th>
            <Table.Th ta="right">Interactions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((c) => (
            <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/contacts/${c.id}`)}>
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <Avatar src={c.image_url} radius="xl" color="clay" size={28}>
                    {initials(c.name)}
                  </Avatar>
                  <Text fw={600} size="sm">{c.name}</Text>
                  {c.vip && <Badge size="xs" variant="light" color={VIP_COLOR}>VIP</Badge>}
                </Group>
              </Table.Td>
              <Table.Td><Text size="sm" c="dimmed">{c.email || c.phone || '—'}</Text></Table.Td>
              <Table.Td>
                {c.pr_involvement
                  ? <Badge size="xs" variant="light" color={INVOLVEMENT_COLOR}>{c.pr_involvement}</Badge>
                  : <Text size="sm" c="dimmed">—</Text>}
              </Table.Td>
              <Table.Td ta="right"><Text size="sm">{c.interaction_count || '—'}</Text></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );

  const showTable = isWide && view === 'table';

  return (
    <Box style={{ maxWidth: isWide ? 1100 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <ListToolbar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search contacts…"
        filters={
          <Select
            w={isWide ? 190 : undefined}
            leftSection={<IconMapPin size={16} />}
            placeholder="All regions"
            aria-label="Filter by region"
            data={(me?.regions ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
            value={regionId}
            onChange={setRegionId}
            clearable
            searchable
          />
        }
        sort={{ value: sort, onChange: setSort, options: SORT_OPTIONS }}
        groupBy={{ value: groupBy, onChange: setGroupBy, options: GROUP_OPTIONS }}
        view={{ value: view, onChange: setView }}
        count={loading ? undefined : { shown: contacts.length, label: contacts.length === 1 ? 'contact' : 'contacts' }}
        trailing={
          <Button leftSection={<IconPlus size={16} />} onClick={open}>
            New
          </Button>
        }
      />

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
        <Stack gap="lg">
          {groups.map((g) => (
            <Box key={g.key}>
              {g.title && (
                <Group gap="xs" mb="sm">
                  <Text ff="heading" fw={600} fz="lg">{g.title}</Text>
                  <Badge size="sm" variant="light" color="river">{g.items.length}</Badge>
                </Group>
              )}
              {showTable ? contactsTable(g.items) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {g.items.map(contactCard)}
                </SimpleGrid>
              )}
            </Box>
          ))}
        </Stack>
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
    </Box>
  );
}
