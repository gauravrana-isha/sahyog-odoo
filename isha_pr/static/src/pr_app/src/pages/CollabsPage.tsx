import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Group, Modal, SegmentedControl, Select, Stack, Text, TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconMicrophone, IconPlus, IconSearch, IconAlertTriangle, IconSparkles,
} from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import { COLLAB_STAGE_COLOR, RECOMMENDATION_COLOR } from '../tokens';
import { EntityCard } from '../components/EntityCard';
import { IconTile } from '../components/IconTile';
import { CardSkeleton } from '../components/CardSkeleton';
import { EmptyState } from '../components/EmptyState';
import type { CollabLight, Paged, CollabDetail } from '../types';

const STAGES = [
  { label: 'All', value: 'all' },
  { label: 'Received', value: 'received' },
  { label: 'Evaluated', value: 'evaluated' },
  { label: 'Approved', value: 'approved' },
  { label: 'Actioned', value: 'actioned' },
];
const TYPES = [
  { value: 'podcast', label: 'Podcast' },
  { value: 'conference', label: 'Conference' },
  { value: 'program', label: 'Program Collaboration' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));
const REC_LABEL: Record<string, string> = {
  sadhguru: 'Sadhguru-level', global_coordinator: 'Global Coordinator',
  local_teacher: 'Local Teacher', decline: 'Decline',
};
const STAGE_LABEL: Record<string, string> = {
  received: 'Received', evaluated: 'Evaluated', approved: 'Approved',
  actioned: 'Actioned', declined: 'Declined',
};

export function CollabsPage() {
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [items, setItems] = useState<CollabLight[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('all');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: '', request_type: 'podcast', host_names: '', links: '', source: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (stage !== 'all') params.set('stage', stage);
    if (q.trim()) params.set('q', q.trim());
    apiGet<Paged<CollabLight>>(`/collabs?${params}`)
      .then((r) => setItems(r.records)).catch(() => setItems([])).finally(() => setLoading(false));
  }, [stage, q]);

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const create = async () => {
    if (!draft.name.trim()) { notifications.show({ color: 'red', message: 'Give the opportunity a name.' }); return; }
    setSaving(true);
    try {
      const rec = await apiPost<CollabDetail>('/collabs/create', draft);
      notifications.show({ color: 'green', message: 'Request raised — AI will evaluate it shortly.' });
      setModal(false);
      setDraft({ name: '', request_type: 'podcast', host_names: '', links: '', source: '' });
      navigate(`/collabs/${rec.id}`);
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally { setSaving(false); }
  };

  return (
    <Stack p="md" pb={90} gap="sm" maw={820} mx="auto">
      <Group justify="space-between" wrap="nowrap">
        <div>
          <Text ff="heading" fw={700} size="xl">Collaborations</Text>
          <Text c="dimmed" size="sm">Podcast, conference &amp; program opportunities</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} color="clay" onClick={() => setModal(true)}>
          {isWide ? 'New request' : 'New'}
        </Button>
      </Group>

      <TextInput
        placeholder="Search opportunity or host…"
        leftSection={<IconSearch size={16} />}
        value={q} onChange={(e) => setQ(e.currentTarget.value)}
      />
      <SegmentedControl fullWidth size="xs" data={STAGES} value={stage} onChange={setStage} />

      {loading ? (
        <Stack gap="sm"><CardSkeleton /><CardSkeleton /><CardSkeleton /></Stack>
      ) : items.length === 0 ? (
        <EmptyState icon={IconMicrophone} title="No collaboration requests"
          description="Raise one with “New request” — the AI will evaluate reach, credibility and risk." />
      ) : (
        <Stack gap="sm">
          {items.map((c, i) => (
            <EntityCard
              key={c.id}
              stagger={i}
              leading={<IconTile color={COLLAB_STAGE_COLOR[c.stage] || 'gray'} icon={IconMicrophone} />}
              title={c.name}
              badges={
                <>
                  {c.risk_level === 'high' && (
                    <Badge color="red" variant="light" leftSection={<IconAlertTriangle size={11} />}>Risk</Badge>
                  )}
                  {c.recommendation && (
                    <Badge color={RECOMMENDATION_COLOR[c.recommendation] || 'gray'} variant="light">
                      {REC_LABEL[c.recommendation]}
                    </Badge>
                  )}
                  <Badge color={COLLAB_STAGE_COLOR[c.stage] || 'gray'} variant="dot">
                    {STAGE_LABEL[c.stage] || c.stage}
                  </Badge>
                </>
              }
              meta={
                <Group gap={6} mt={4}>
                  <Text size="xs" c="dimmed">{TYPE_LABEL[c.request_type] || c.request_type}</Text>
                  {c.audience_size && <><Text size="xs" c="dimmed">·</Text><Text size="xs" c="dimmed">{c.audience_size.slice(0, 30)}</Text></>}
                </Group>
              }
              onClick={() => navigate(`/collabs/${c.id}`)}
            />
          ))}
        </Stack>
      )}

      <Modal opened={modal} onClose={() => setModal(false)} title="New collaboration request" centered>
        <Stack gap="sm">
          <TextInput label="Opportunity" required placeholder="e.g. PBD Podcast"
            value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })} />
          <Select label="Type" data={TYPES} value={draft.request_type}
            onChange={(v) => setDraft({ ...draft, request_type: v || 'podcast' })} />
          <TextInput label="Host / Organizer" value={draft.host_names}
            onChange={(e) => setDraft({ ...draft, host_names: e.currentTarget.value })} />
          <TextInput label="Link(s)" value={draft.links}
            onChange={(e) => setDraft({ ...draft, links: e.currentTarget.value })} />
          <TextInput label="Source of request" placeholder="Email lead / internal / who raised it"
            value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.currentTarget.value })} />
          <Group gap={6} c="dimmed">
            <IconSparkles size={14} />
            <Text size="xs">The AI will research reach, credibility &amp; backlash risk automatically.</Text>
          </Group>
          <Button color="clay" loading={saving} onClick={create}>Raise request</Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
