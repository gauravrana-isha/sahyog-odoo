import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Button, Card, Group, Modal, SegmentedControl, Select, SimpleGrid, Stack,
  Text, TextInput, Textarea, ThemeIcon, UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconMicrophone, IconPlus, IconSearch, IconAlertTriangle, IconSparkles,
  IconGavel, IconInbox,
} from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import { COLLAB_STAGE_COLOR, RECOMMENDATION_COLOR } from '../tokens';
import { EntityCard } from '../components/EntityCard';
import { IconTile } from '../components/IconTile';
import { CardSkeleton } from '../components/CardSkeleton';
import { EmptyState } from '../components/EmptyState';
import type { CollabLight, Paged, CollabDetail, CollabOverview } from '../types';

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
function StatTile({ label, value, icon: Icon, color, active, onClick }: {
  label: string; value: number; icon: typeof IconInbox; color: string;
  active?: boolean; onClick?: () => void;
}) {
  const inner = (
    <Card withBorder radius="md" p="sm" h="100%"
      style={active ? { borderColor: `var(--mantine-color-${color}-5)`, background: `var(--mantine-color-${color}-light)` } : undefined}>
      <Group gap={8} wrap="nowrap" align="center">
        <ThemeIcon variant="light" color={color} radius="md" size="lg"><Icon size={17} /></ThemeIcon>
        <Text fw={800} fz={22} lh={1}>{value.toLocaleString()}</Text>
        <Text size="xs" c="dimmed" lh={1.15} style={{ flex: 1 }}>{label}</Text>
      </Group>
    </Card>
  );
  return onClick
    ? <UnstyledButton onClick={onClick} style={{ height: '100%' }}>{inner}</UnstyledButton>
    : inner;
}

export function CollabsPage() {
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [items, setItems] = useState<CollabLight[]>([]);
  const [overview, setOverview] = useState<CollabOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('all');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: '', request_type: 'podcast', host_names: '', links: '', details: '', source: '' });

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (stage !== 'all') params.set('stage', stage);
    if (q.trim()) params.set('q', q.trim());
    apiGet<Paged<CollabLight>>(`/collabs?${params}`)
      .then((r) => { setItems(r.records); if (r.overview) setOverview(r.overview); })
      .catch(() => setItems([])).finally(() => setLoading(false));
  }, [stage, q]);

  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const create = async () => {
    if (!draft.name.trim()) { notifications.show({ color: 'red', message: 'Give the opportunity a name.' }); return; }
    setSaving(true);
    try {
      const rec = await apiPost<CollabDetail>('/collabs/create', draft);
      notifications.show({ color: 'green', message: 'Request raised — AI will evaluate it shortly.' });
      setModal(false);
      setDraft({ name: '', request_type: 'podcast', host_names: '', links: '', details: '', source: '' });
      navigate(`/collabs/${rec.id}`);
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally { setSaving(false); }
  };

  return (
    <Stack p="md" pb={90} gap="sm" maw={isWide ? 1160 : 820} mx="auto">
      <Group wrap="nowrap" gap="sm">
        <TextInput
          style={{ flex: 1 }}
          placeholder="Search opportunity or host…"
          leftSection={<IconSearch size={16} />}
          value={q} onChange={(e) => setQ(e.currentTarget.value)}
        />
        <Button leftSection={<IconPlus size={16} />} color="clay" onClick={() => setModal(true)}>
          {isWide ? 'New request' : 'New'}
        </Button>
      </Group>

      {overview && overview.total > 0 && (
        <SimpleGrid cols={3} spacing="sm">
          <StatTile label="Total" value={overview.total} icon={IconInbox} color="river"
            active={stage === 'all'} onClick={() => setStage('all')} />
          <StatTile label="To decide" value={overview.to_decide} icon={IconGavel} color="ochre"
            active={stage === 'evaluated'} onClick={() => setStage('evaluated')} />
          <StatTile label="High risk" value={overview.high_risk} icon={IconAlertTriangle} color="red" />
        </SimpleGrid>
      )}

      <SegmentedControl fullWidth size="xs" data={STAGES} value={stage} onChange={setStage} />

      {loading ? (
        <Stack gap="sm"><CardSkeleton /><CardSkeleton /><CardSkeleton /></Stack>
      ) : items.length === 0 ? (
        <EmptyState icon={IconMicrophone} title="No collaboration requests"
          description="Raise one with “New request” — the AI will evaluate reach, credibility and risk." />
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
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
        </SimpleGrid>
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
          <Textarea label="Details / Context" autosize minRows={2} maxRows={5}
            placeholder="What exactly are they asking? (speak, podcast, meet Sadhguru), format, dates, who reached out, why now — the AI reads this."
            value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.currentTarget.value })} />
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
