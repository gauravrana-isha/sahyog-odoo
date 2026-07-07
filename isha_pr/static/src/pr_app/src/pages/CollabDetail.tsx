import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Accordion, Badge, Button, Card, Center, Group, Loader, Modal,
  Select, SimpleGrid, Stack, Text, TextInput, Textarea, ThemeIcon,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconDeviceFloppy, IconCheck, IconX, IconSparkles,
  IconAlertTriangle, IconMicrophone2, IconFileCheck, IconLink,
  IconUsers, IconEye, IconActivity, IconStar, IconChartBar, IconPencil,
} from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import { usePR } from '../hooks/usePR';
import { COLLAB_STAGE_COLOR, RISK_COLOR, RECOMMENDATION_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { parseSourceLinks, SourceLinksList } from '../components/SourceLinks';
import { SectionCard } from '../components/SectionCard';
import { RecordFooter } from '../components/RecordFooter';
import type { CollabDetail as Detail } from '../types';

function parseHeadlines(raw: string): Record<string, string> {
  if (!raw) return {};
  try { const o = JSON.parse(raw); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}

const REC_OPTS = [
  { value: 'sadhguru', label: 'Sadhguru-level Engagement' },
  { value: 'global_coordinator', label: 'Global Coordinator' },
  { value: 'local_teacher', label: 'Local Teacher' },
  { value: 'decline', label: 'Decline' },
];
const RISK_OPTS = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' },
];
const STAGE_LABEL: Record<string, string> = {
  received: 'Received', evaluated: 'Evaluated', approved: 'Approved',
  actioned: 'Actioned', declined: 'Declined',
};
const TYPE_LABEL: Record<string, string> = {
  podcast: 'Podcast', conference: 'Conference', program: 'Program Collaboration',
  meeting: 'Meeting', event: 'Event', other: 'Other',
};
const QUALITATIVE: Array<[keyof Detail, string]> = [
  ['audience_fit', 'Audience Fit'],
  ['host_credibility', 'Host Credibility & History'],
  ['brand_alignment', 'Brand Alignment'],
  ['content_control', 'Content Control'],
  ['guest_history', 'Guest History'],
  ['potential_backlash', 'Potential Backlash'],
  ['opportunity_cost', 'Opportunity Cost'],
  ['long_term_value', 'Long-Term Value'],
];
const METRICS: Array<{ key: keyof Detail; label: string; icon: typeof IconUsers; color: string }> = [
  { key: 'audience_size', label: 'Audience', icon: IconUsers, color: 'river' },
  { key: 'avg_views', label: 'Avg Views', icon: IconEye, color: 'clay' },
  { key: 'engagement_rate', label: 'Engagement', icon: IconActivity, color: 'sage' },
  { key: 'ratings_score', label: 'Rating', icon: IconStar, color: 'ochre' },
  { key: 'subscriber_view_ratio', label: 'View Ratio', icon: IconChartBar, color: 'river' },
];

export function CollabDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me } = usePR();
  const isAdmin = !!me?.can.admin;
  const isWide = useMediaQuery('(min-width: 768px)');
  const [metricModal, setMetricModal] = useState<null | { label: string; headline: string; detail: string }>(null);
  const [data, setData] = useState<Detail | null>(null);
  const [f, setF] = useState<Partial<Detail>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [editReach, setEditReach] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiGet<Detail>(`/collabs/${id}`)
      .then((d) => { setData(d); setF(d); })
      .catch(() => setData(null)).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const set = (k: keyof Detail, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const d = await apiPost<Detail>(`/collabs/${id}/update`, f);
      setData(d); setF(d);
      notifications.show({ color: 'green', message: 'Saved' });
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally { setSaving(false); }
  };

  const runAction = async (action: string) => {
    setActing(action);
    try {
      const d = await apiPost<Detail>(`/collabs/${id}/action`, { action });
      setData(d); setF(d);
      notifications.show({ color: 'green', message: 'Updated' });
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally { setActing(null); }
  };

  const del = async () => {
    if (!window.confirm('Permanently delete this collaboration request? This cannot be undone — consider Archive instead.')) return;
    try {
      await apiPost(`/collabs/${id}/delete`, {});
      notifications.show({ color: 'green', message: 'Deleted' });
      navigate('/collabs');
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    }
  };

  if (loading) return <Center py="xl"><Loader color="clay" /></Center>;
  if (!data) return <EmptyState icon={IconMicrophone2} title="Request not found" description="It may have been removed." />;

  const stage = data.stage;
  const sources = parseSourceLinks(data.source_links);
  const headlines = parseHeadlines(data.reach_headlines);
  const recColor = RECOMMENDATION_COLOR[data.recommendation] || 'sand';
  const recLabel = REC_OPTS.find((r) => r.value === data.recommendation)?.label;
  const confPct = Math.round((data.eval_confidence || 0) * 100);
  const actions = [
    { action: 'evaluate', label: 'Mark Evaluated', icon: IconCheck, show: stage === 'received', color: 'river' },
    { action: 'approve', label: 'Approve', icon: IconCheck, show: isAdmin && stage === 'evaluated', color: 'sage' },
    { action: 'decline', label: 'Decline', icon: IconX, show: isAdmin && ['received', 'evaluated'].includes(stage), color: 'red' },
    { action: 'action', label: 'Mark Actioned', icon: IconFileCheck, show: stage === 'approved', color: 'clay' },
  ].filter((a) => a.show);

  // Section bodies defined once, rendered as an accordion on mobile and as an
  // open card grid on desktop (mobile layout is kept; desktop uses the width).
  const reachBlock = (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" mb="sm" wrap="nowrap">
        <Group gap={8} wrap="nowrap">
          <ThemeIcon variant="light" color="clay" radius="md" size="md"><IconMicrophone2 size={15} /></ThemeIcon>
          <div>
            <Text fw={700} size="sm">Reach &amp; Influence</Text>
            <Text size="xs" c="dimmed">Requester&apos;s reach — not Sadhguru&apos;s</Text>
          </div>
        </Group>
        <Button size="compact-xs" variant="subtle" color="clay"
          leftSection={<IconPencil size={12} />} onClick={() => setEditReach((v) => !v)}>
          {editReach ? 'Done' : 'Edit'}
        </Button>
      </Group>
      {editReach ? (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="xs">
          {METRICS.map((m) => (
            <Textarea key={m.key} label={m.label} autosize minRows={1} maxRows={4}
              value={(f[m.key] as string) || ''} onChange={(e) => set(m.key, e.currentTarget.value)} />
          ))}
        </SimpleGrid>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} spacing="xs">
          {METRICS.map((m) => {
            const headline = (headlines[m.key] || '').trim();
            const detail = ((data[m.key] as string) || '').trim();
            const clickable = !!detail;
            return (
              <Card key={m.key} withBorder radius="md" p="sm"
                onClick={clickable ? () => setMetricModal({ label: m.label, headline, detail }) : undefined}
                style={clickable ? { cursor: 'pointer' } : undefined}>
                <Group gap={6} mb={6} wrap="nowrap">
                  <ThemeIcon size="sm" variant="light" color={m.color} radius="sm"><m.icon size={13} /></ThemeIcon>
                  <Text size="xs" c="dimmed" fw={600}>{m.label}</Text>
                </Group>
                {headline ? (
                  <Text ff="heading" fw={800} fz={20} lh={1.1}>{headline}</Text>
                ) : (
                  <Text fw={600} fz={14} c={detail ? undefined : 'dimmed'}>{detail ? '' : '—'}</Text>
                )}
                {detail && (
                  <>
                    <Text size="xs" c="dimmed" mt={4} lineClamp={2}>{detail}</Text>
                    <Text size="xs" c="river" mt={4} fw={500}>Read more →</Text>
                  </>
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      )}
    </Card>
  );

  const qualBody = (
    <Stack gap="xs">
      {QUALITATIVE.map(([k, label]) => (
        <Textarea key={k} label={label} autosize minRows={1} maxRows={6}
          value={(f[k] as string) || ''} onChange={(e) => set(k, e.currentTarget.value)} />
      ))}
      <Text size="xs" c="dimmed">Citations like [1] refer to the numbered Sources list.</Text>
    </Stack>
  );
  const decisionBody = (
    <Stack gap="xs">
      <Textarea label="Recommendation Notes" autosize minRows={2}
        value={f.recommendation_notes || ''} onChange={(e) => set('recommendation_notes', e.currentTarget.value)} />
      <Textarea label="Action Taken" autosize minRows={2} placeholder="What happened…"
        value={f.action_taken || ''} onChange={(e) => set('action_taken', e.currentTarget.value)} />
      <Textarea label="Notes" autosize minRows={2}
        value={f.notes || ''} onChange={(e) => set('notes', e.currentTarget.value)} />
    </Stack>
  );
  const intakeBody = (
    <Stack gap="xs">
      <TextInput label="Host / Organizer" value={f.host_names || ''} onChange={(e) => set('host_names', e.currentTarget.value)} />
      <TextInput label="Link(s)" value={f.links || ''} onChange={(e) => set('links', e.currentTarget.value)} />
      <Textarea label="Details / Context" autosize minRows={2} maxRows={6}
        placeholder="The actual ask + context the AI should factor in…"
        value={f.details || ''} onChange={(e) => set('details', e.currentTarget.value)} />
      <TextInput label="Source of request" value={f.source || ''} onChange={(e) => set('source', e.currentTarget.value)} />
      <TextInput label="Requested by" value={f.requester_name || ''} onChange={(e) => set('requester_name', e.currentTarget.value)} />
    </Stack>
  );
  const sourcesBody = sources.length > 0 && (
    <>
      <Text size="xs" c="dimmed" mb="xs">Where the AI got its information — cited inline as [n].</Text>
      <SourceLinksList sources={sources} />
    </>
  );

  const sections = (
    isWide ? (
      <SimpleGrid cols={2} spacing="md" style={{ alignItems: 'start' }}>
        <SectionCard title="Qualitative Assessment">{qualBody}</SectionCard>
        <Stack gap="md">
          <SectionCard title="Decision & Action">{decisionBody}</SectionCard>
          <SectionCard title="Intake">{intakeBody}</SectionCard>
          {sources.length > 0 && (
            <SectionCard title={`Sources (${sources.length})`} icon={<IconLink size={15} />}>{sourcesBody}</SectionCard>
          )}
        </Stack>
      </SimpleGrid>
    ) : (
      <Accordion multiple defaultValue={['assessment']} variant="separated">
        <Accordion.Item value="assessment">
          <Accordion.Control>Qualitative Assessment</Accordion.Control>
          <Accordion.Panel>{qualBody}</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="decision">
          <Accordion.Control>Decision &amp; Action</Accordion.Control>
          <Accordion.Panel>{decisionBody}</Accordion.Panel>
        </Accordion.Item>
        <Accordion.Item value="intake">
          <Accordion.Control>Intake</Accordion.Control>
          <Accordion.Panel>{intakeBody}</Accordion.Panel>
        </Accordion.Item>
        {sources.length > 0 && (
          <Accordion.Item value="sources">
            <Accordion.Control icon={<IconLink size={16} />}>Sources ({sources.length})</Accordion.Control>
            <Accordion.Panel>{sourcesBody}</Accordion.Panel>
          </Accordion.Item>
        )}
      </Accordion>
    )
  );

  return (
    <Stack pb={90} maw={isWide ? 1160 : 760} mx="auto" p="md" gap="md">
      <Group justify="space-between">
        <Button variant="subtle" color="clay" leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/collabs')} px={4}>Back</Button>
        <Button color="clay" leftSection={<IconDeviceFloppy size={16} />} loading={saving} onClick={save}>Save</Button>
      </Group>

      {/* Headline + verdict badges (compact — no scorecard block) */}
      <div>
        <Text ff="heading" fw={700} size="xl" lh={1.2}>{data.name}</Text>
        <Text size="sm" c="dimmed">{data.host_names || TYPE_LABEL[data.request_type] || ''}</Text>
        <Group gap={6} mt={8}>
          {recLabel && (
            <Badge color={recColor} variant="filled">{recLabel}</Badge>
          )}
          {data.risk_level && (
            <Badge color={RISK_COLOR[data.risk_level]} variant="light"
              leftSection={data.risk_level === 'high' ? <IconAlertTriangle size={11} /> : undefined}>
              {data.risk_level} risk
            </Badge>
          )}
          <Badge color={COLLAB_STAGE_COLOR[stage] || 'gray'} variant="dot">{STAGE_LABEL[stage] || stage}</Badge>
          {confPct > 0 && <Badge color="grape" variant="light" leftSection={<IconSparkles size={11} />}>AI {confPct}%</Badge>}
          {data.active === false && <Badge color="gray" variant="filled">Archived</Badge>}
        </Group>
      </div>

      {/* Stage actions */}
      {actions.length > 0 && (
        <Group gap="xs">
          {actions.map((a) => (
            <Button key={a.action} size="xs" color={a.color} variant={a.action === 'decline' ? 'outline' : 'filled'}
              leftSection={<a.icon size={14} />} loading={acting === a.action} onClick={() => runAction(a.action)}>
              {a.label}
            </Button>
          ))}
        </Group>
      )}

      {/* AI summary — modest, not a big colored block */}
      {data.eval_summary && (
        <Card withBorder radius="md" p="sm"
          style={{ borderLeft: '3px solid var(--mantine-color-clay-5)' }}>
          <Group gap={6} mb={4}>
            <IconSparkles size={13} color="var(--mantine-color-clay-6)" />
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: '.05em' }}>AI Summary</Text>
          </Group>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{data.eval_summary}</Text>
        </Card>
      )}

      {/* Decision selects */}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select label="Recommendation" data={REC_OPTS} value={f.recommendation || ''} clearable
          onChange={(v) => set('recommendation', v || '')} />
        <Select label="Backlash Risk" data={RISK_OPTS} value={f.risk_level || ''} clearable
          onChange={(v) => set('risk_level', v || '')} />
      </SimpleGrid>

      {reachBlock}
      {sections}

      <RecordFooter
        active={data.active !== false}
        createdBy={data.created_by} createdAt={data.created_at}
        updatedBy={data.updated_by} updatedAt={data.updated_at}
        isAdmin={isAdmin} busy={acting}
        onArchiveToggle={() => runAction(data.active === false ? 'unarchive' : 'archive')}
        onDelete={del}
      />

      {/* Full-detail modal for a reach metric */}
      <Modal opened={!!metricModal} onClose={() => setMetricModal(null)} title={metricModal?.label} centered size="lg">
        {metricModal?.headline && (
          <Text ff="heading" fw={800} fz={26} lh={1.1} mb="sm">{metricModal.headline}</Text>
        )}
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{metricModal?.detail}</Text>
        {sources.length > 0 && (
          <Text size="xs" c="dimmed" mt="md">Numbers like [1] are cited in the Sources section.</Text>
        )}
      </Modal>
    </Stack>
  );
}
