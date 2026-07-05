import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextInput, Stack, Card, Text, Group, Badge, Button, Modal, Loader, Center, Avatar,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconSearch, IconPlus } from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import type { Contact } from '../types';

export function ContactsPage() {
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = useCallback((search: string) => {
    setLoading(true);
    apiGet<Contact[]>(`/contacts${search ? `?q=${encodeURIComponent(search)}` : ''}`)
      .then(setContacts)
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q, load]);

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

  return (
    <Stack>
      <Group>
        <TextInput
          flex={1}
          leftSection={<IconSearch size={16} />}
          placeholder="Search contacts…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
        <Button leftSection={<IconPlus size={16} />} color="grape" onClick={open}>
          New
        </Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : contacts.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No contacts found.</Text>
      ) : (
        contacts.map((c) => (
          <Card key={c.id} withBorder padding="sm" style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/contacts/${c.id}`)}>
            <Group justify="space-between" wrap="nowrap">
              <Group wrap="nowrap">
                <Avatar src={c.image_url} radius="xl" color="grape">
                  {c.name.slice(0, 1)}
                </Avatar>
                <div>
                  <Group gap={6}>
                    <Text fw={600}>{c.name}</Text>
                    {c.vip && <Badge size="xs" color="yellow">VIP</Badge>}
                  </Group>
                  <Text size="xs" c="dimmed">{c.email || c.phone || '—'}</Text>
                </div>
              </Group>
              <Group gap="xs">
                {c.pr_involvement &&
                  <Badge variant="light" color="grape">{c.pr_involvement}</Badge>}
                {c.interaction_count > 0 &&
                  <Badge variant="light">{c.interaction_count}</Badge>}
              </Group>
            </Group>
          </Card>
        ))
      )}

      <Modal opened={opened} onClose={close} title="New PR contact">
        <Stack>
          <TextInput label="Name" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <TextInput label="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} />
          <TextInput label="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} />
          <Button color="grape" loading={saving} onClick={create}>Create</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
