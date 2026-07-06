import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Accordion, Alert, Badge, Box, Button, Center, Group, Loader, Progress,
  Select, SimpleGrid, Stack, Text, TextInput, Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconDeviceFloppy, IconCheck, IconX, IconSparkles,
  IconAlertTriangle, IconMicrophone2, IconFileCheck,
} from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import { usePR } from '../hooks/usePR';
import { COLLAB_STAGE_COLOR, RISK_COLOR, RECOMMENDATION_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import type { CollabDetail as Detail } from '../types';

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
const METRICS: Array<[keyof Detail, string]> = [
  ['audience_size', 'Audience Size'],
  ['avg_views', 'Avg Views / Listens'],
  ['engagement_rate', 'Engagement Rate'],
  ['ratings_score', 'Ratings Score'],
  ['subscriber_view_ratio', 'Subscriber–View Ratio'],
];

export function CollabDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { me } = usePR();
  const isAdmin = !!me?.can.admin;
  const [data, setData] = useState<Detail | null>(null);
  const [f, setF] = useState<Partial<Detail>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

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

  if (loading) return <Center py="xl"><Loader color="clay" /></Center>;
  if (!data) return <EmptyState icon={IconMicrophone2} title="Request not found" description="It may have been removed." />;

  const stage = data.stage;
  const actions = [
    { action: 'evaluate', label: 'Mark Evaluated', icon: IconCheck, show: stage === 'received', color: 'river' },
    { action: 'approve', label: 'Approve', icon: IconCheck, show: isAdmin && stage === 'evaluated', color: 'sage' },
    { action: 'decline', label: 'Decline', icon: IconX, show: isAdmin && ['received', 'evaluated'].includes(stage), color: 'red' },
    { action: 'action', label: 'Mark Actioned', icon: IconFileCheck, show: stage === 'approved', color: 'clay' },
  ].filter((a) => a.show);

  return (
    <Stack pb={90} maw={760} mx="auto" p="md" gap="md">
      <Group justify="space-between">
        <Button variant="subtle" color="clay" leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/collabs')} px={4}>Back</Button>
        <Button color="clay" leftSection={<IconDeviceFloppy size={16} />} loading={saving} onClick={save}>Save</Button>
      </Group>

      {/* Headline */}
      <div>
        <Text ff="heading" fw={700} size="xl" lh={1.2}>{data.name}</Text>
        <Group gap={6} mt={6}>
          <Badge color={COLLAB_STAGE_COLOR[stage] || 'gray'} variant="dot">{STAGE_LABEL[stage] || stage}</Badge>
          {data.recommendation && (
            <Badge color={RECOMMENDATION_COLOR[data.recommendation] || 'gray'} variant="light">
              {REC_OPTS.find((r) => r.value === data.recommendation)?.label}
            </Badge>
          )}
          {data.risk_level && (
            <Badge color={RISK_COLOR[data.risk_level] || 'gray'} variant="light"
              leftSection={data.risk_level === 'high' ? <IconAlertTriangle size={11} /> : undefined}>
              {data.risk_level} risk
            </Badge>
          )}
          {data.enriched && <Badge color="grape" variant="light" leftSection={<IconSparkles size={11} />}>AI evaluated</Badge>}
        </Group>
      </div>

      {/* AI summary */}
      {data.eval_summary && (
        <Alert color="clay" variant="light" icon={<IconSparkles size={18} />} title="Evaluation summary">
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{data.eval_summary}</Text>
          {data.eval_confidence > 0 && (
            <Group gap={8} mt={8} align="center">
              <Text size="xs" c="dimmed">Confidence</Text>
              <Progress value={data.eval_confidence * 100} color="clay" size="sm" w={120} />
              <Text size="xs" c="dimmed">{Math.round(data.eval_confidence * 100)}%</Text>
            </Group>
          )}
        </Alert>
      )}

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

      {/* Decision fields */}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select label="Recommendation" data={REC_OPTS} value={f.recommendation || ''} clearable
          onChange={(v) => set('recommendation', v || '')} />
        <Select label="Backlash Risk" data={RISK_OPTS} value={f.risk_level || ''} clearable
          onChange={(v) => set('risk_level', v || '')} />
      </SimpleGrid>

      <Accordion multiple defaultValue={['metrics', 'assessment']} variant="separated">
        <Accordion.Item value="metrics">
          <Accordion.Control icon={<IconMicrophone2 size={16} />}>Reach &amp; Influence</Accordion.Control>
          <Accordion.Panel>
            <Text size="xs" c="dimmed" mb="xs">AI estimates — verify high-stakes numbers on the platform.</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
              {METRICS.map(([k, label]) => (
                <TextInput key={k} label={label} value={(f[k] as string) || ''}
                  onChange={(e) => set(k, e.currentTarget.value)} />
              ))}
            </SimpleGrid>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="assessment">
          <Accordion.Control>Qualitative Assessment</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              {QUALITATIVE.map(([k, label]) => (
                <Textarea key={k} label={label} autosize minRows={1} maxRows={5}
                  value={(f[k] as string) || ''} onChange={(e) => set(k, e.currentTarget.value)} />
              ))}
              {data.sources && (
                <Box><Text size="xs" fw={600} c="dimmed">Sources</Text>
                  <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>{data.sources}</Text></Box>
              )}
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="decision">
          <Accordion.Control>Decision &amp; Action</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Textarea label="Recommendation Notes" autosize minRows={2}
                value={f.recommendation_notes || ''} onChange={(e) => set('recommendation_notes', e.currentTarget.value)} />
              <Textarea label="Action Taken" autosize minRows={2} placeholder="What happened…"
                value={f.action_taken || ''} onChange={(e) => set('action_taken', e.currentTarget.value)} />
              <Textarea label="Notes" autosize minRows={2}
                value={f.notes || ''} onChange={(e) => set('notes', e.currentTarget.value)} />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="intake">
          <Accordion.Control>Intake</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <TextInput label="Host / Organizer" value={f.host_names || ''} onChange={(e) => set('host_names', e.currentTarget.value)} />
              <TextInput label="Link(s)" value={f.links || ''} onChange={(e) => set('links', e.currentTarget.value)} />
              <TextInput label="Source of request" value={f.source || ''} onChange={(e) => set('source', e.currentTarget.value)} />
              <TextInput label="Requested by" value={f.requester_name || ''} onChange={(e) => set('requester_name', e.currentTarget.value)} />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}
