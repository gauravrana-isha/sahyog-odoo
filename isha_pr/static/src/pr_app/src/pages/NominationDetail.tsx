import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Accordion, Anchor, Avatar, Badge, Box, Button, Card, Group, Select,
  SimpleGrid, Stack, Switch, Text, Textarea, TextInput, Timeline,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconAwardOff, IconCheck, IconDeviceFloppy, IconFlag,
  IconFlame, IconPlant, IconX,
} from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import { usePR } from '../hooks/usePR';
import { STAGE_COLOR, TIER_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/CardSkeleton';
import { Field } from '../components/Field';
import type { Nomination } from '../types';

const TIER_OPTIONS = [
  { value: '1', label: 'Tier 1 — Priority Lead' },
  { value: '2', label: 'Tier 2 — Further Review' },
  { value: '3', label: 'Tier 3 — Not a Priority' },
];

const VERTICAL_OPTIONS = [
  { value: 'business', label: 'Business & Corporate' },
  { value: 'asscm', label: 'Arts, Sports & Culture (ASSCM)' },
  { value: 'academia', label: 'Academia & Education' },
  { value: 'ngo_govt', label: 'Public Service (Govt & Civic)' },
  { value: 'medical', label: 'Medical & Healthcare' },
  { value: 'media', label: 'Media' },
  { value: 'emerging', label: 'Emerging & Next-Generation' },
  { value: 'environment', label: 'Environment & Sustainability' },
  { value: 'uncategorized', label: 'Uncategorized' },
  { value: 'review', label: 'Uncategorized (needs review)' },
];

const RECOMMENDATION_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'maybe', label: 'Maybe / Further Review' },
  { value: 'not_recommended', label: 'Not Recommended' },
];

const PROCEED_LABELS: Record<string, string> = {
  self_invite: 'Will invite the nominee directly',
  guidance: 'Wants guidance, will extend the invitation themselves',
  isha_reach_out: 'Prefers Isha to reach out, will facilitate',
};

const YES_NO: Record<string, string> = { yes: 'Yes', no: 'No', unknown: 'Not sure' };

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

interface ResearchDraft {
  tier: string | null;
  vertical: string | null;
  research_recommendation: string | null;
  research_notes: string;
  next_step: string;
  high_priority: boolean;
}

export function NominationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { me } = usePR();
  const isWide = useMediaQuery('(min-width: 768px)');
  const isAdmin = !!me?.can.admin;

  const [data, setData] = useState<Nomination | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [research, setResearch] = useState<ResearchDraft | null>(null);

  const applyData = (n: Nomination) => {
    setData(n);
    setResearch({
      tier: n.tier || null,
      vertical: n.vertical || null,
      research_recommendation: n.research_recommendation || null,
      research_notes: n.research_notes,
      next_step: n.next_step,
      high_priority: n.high_priority,
    });
  };

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiGet<Nomination>(`/nominations/${id}`)
      .then(applyData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const saveResearch = async () => {
    if (!research || !id) return;
    setSaving(true);
    try {
      const updated = await apiPost<Nomination>(`/nominations/${id}/update`, research);
      applyData(updated);
      notifications.show({ color: 'green', message: 'Research saved' });
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally { setSaving(false); }
  };

  const runAction = async (action: string) => {
    if (!id) return;
    setActing(action);
    try {
      const updated = await apiPost<Nomination>(`/nominations/${id}/action`, { action });
      applyData(updated);
      notifications.show({ color: 'green', message: 'Stage updated' });
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally { setActing(null); }
  };

  if (loading) {
    return (
      <Box style={{ maxWidth: isWide ? 760 : undefined, margin: isWide ? '0 auto' : undefined }}>
        <Stack gap="sm">{[1, 2, 3].map((i) => <CardSkeleton key={i} leading="avatar" />)}</Stack>
      </Box>
    );
  }
  if (!data || !research) {
    return (
      <EmptyState
        icon={IconAwardOff}
        title="Nomination not found"
        description="It may have been removed, or you may not have access."
      />
    );
  }

  const stageActions: Array<{ action: string; label: string; icon: typeof IconCheck; color?: string; show: boolean }> = [
    { action: 'mark_researched', label: 'Mark Researched', icon: IconFlag, show: data.stage === 'nominated' },
    { action: 'approve', label: 'Approve', icon: IconCheck, show: isAdmin && data.stage === 'researched' },
    { action: 'reject', label: 'Reject', icon: IconX, color: 'red', show: isAdmin && ['nominated', 'researched'].includes(data.stage) },
    { action: 'start_nurturing', label: 'Start Nurturing', icon: IconPlant, show: data.stage === 'approved' },
  ];
  const visibleActions = stageActions.filter((a) => a.show);

  return (
    <Box style={{ maxWidth: isWide ? 760 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <Stack gap="md">
        <Group justify="space-between" wrap="nowrap">
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} px={4}
            onClick={() => navigate('/nominations')}>Back</Button>
          <Badge variant="light" size="lg" color={STAGE_COLOR[data.stage] || 'sand'}>
            {data.stage_label || data.stage}
          </Badge>
        </Group>

        {/* Hero */}
        <Group wrap="nowrap" align="flex-start">
          <Avatar size={64} radius="xl" color="clay" src={data.image_url}>
            {initials(data.nominee)}
          </Avatar>
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6}>
              <Text ff="heading" fw={600} fz={24} lh={1.2}>{data.nominee}</Text>
              {data.high_priority && <IconFlame size={20} color="var(--mantine-color-clay-6)" />}
            </Group>
            <Text size="sm" c="dimmed">
              {[data.leadership_position, data.organization].filter(Boolean).join(' · ') || '—'}
            </Text>
            <Group gap={4} mt={6}>
              {data.tier && <Badge size="xs" variant="light" color={TIER_COLOR[data.tier] || 'sand'}>Tier {data.tier}</Badge>}
              {data.vertical_label && <Badge size="xs" variant="light" color="river">{data.vertical_label}</Badge>}
              {data.is_self_nomination && <Badge size="xs" variant="light" color="ochre">Self-nomination</Badge>}
              {data.enriched && <Badge size="xs" variant="light" color="sand">AI enriched</Badge>}
            </Group>
          </Box>
        </Group>

        {/* Stage actions */}
        {visibleActions.length > 0 && (
          <Group gap="xs">
            {visibleActions.map(({ action, label, icon: Icon, color }) => (
              <Button
                key={action}
                size="xs"
                variant={color ? 'light' : 'filled'}
                color={color}
                leftSection={<Icon size={14} />}
                loading={acting === action}
                onClick={() => runAction(action)}
              >
                {label}
              </Button>
            ))}
          </Group>
        )}

        {/* At-a-glance brief */}
        {data.brief && (
          <Card withBorder padding="sm" style={{ backgroundColor: 'light-dark(var(--mantine-color-sand-0), var(--mantine-color-dark-6))' }}>
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={4} style={{ letterSpacing: '0.05em' }}>
              At a glance
            </Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{data.brief}</Text>
          </Card>
        )}

        <Accordion variant="separated" defaultValue="research" multiple={false}>
          {/* Research — editable by coordinators */}
          <Accordion.Item value="research">
            <Accordion.Control>Research & Classification</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
                  <Select label="Tier" placeholder="Untiered" data={TIER_OPTIONS}
                    value={research.tier} onChange={(v) => setResearch({ ...research, tier: v })} clearable />
                  <Select label="Vertical" placeholder="Select" data={VERTICAL_OPTIONS}
                    value={research.vertical} onChange={(v) => setResearch({ ...research, vertical: v })} clearable />
                </SimpleGrid>
                <Select label="Research Recommendation" placeholder="Select" data={RECOMMENDATION_OPTIONS}
                  value={research.research_recommendation}
                  onChange={(v) => setResearch({ ...research, research_recommendation: v })} clearable />
                <Switch label="High priority" checked={research.high_priority}
                  onChange={(e) => setResearch({ ...research, high_priority: e.currentTarget.checked })} />
                <Textarea label="Research / Call Notes" autosize minRows={2}
                  value={research.research_notes}
                  onChange={(e) => setResearch({ ...research, research_notes: e.currentTarget.value })} />
                <TextInput label="Next Step" value={research.next_step}
                  onChange={(e) => setResearch({ ...research, next_step: e.currentTarget.value })} />
                {data.tier_rationale && <Field label="Tier Rationale (AI)" value={data.tier_rationale} />}
                {data.sources && <Field label="Sources" value={data.sources} />}
                <Button leftSection={<IconDeviceFloppy size={16} />} loading={saving} onClick={saveResearch}>
                  Save Research
                </Button>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Profile */}
          <Accordion.Item value="profile">
            <Accordion.Control>Profile & Links</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <SimpleGrid cols={isWide ? 2 : 1} spacing="xs">
                  <Field label="Email" value={data.email} />
                  <Field label="Phone" value={data.phone} />
                  <Field label="Location" value={data.location} />
                  <Field label="Reach / Following" value={data.social_following} />
                </SimpleGrid>
                {(data.website || data.linkedin || data.instagram) && (
                  <Box>
                    <Text size="xs" c="dimmed" mb={2}>Researched Links</Text>
                    <Group gap="sm">
                      {data.website && <Anchor size="sm" href={data.website} target="_blank">Website</Anchor>}
                      {data.linkedin && <Anchor size="sm" href={data.linkedin} target="_blank">LinkedIn</Anchor>}
                      {data.instagram && <Anchor size="sm" href={data.instagram} target="_blank">Instagram</Anchor>}
                    </Group>
                  </Box>
                )}
                {data.social_links && <Field label="Links (from form)" value={data.social_links} />}
                <SimpleGrid cols={isWide ? 2 : 1} spacing="xs">
                  <Field label="Meditator?" value={YES_NO[data.is_meditator]} />
                  <Field label="Completed IE / Shambhavi?" value={YES_NO[data.ie_or_shambhavi]} />
                </SimpleGrid>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Form submission */}
          <Accordion.Item value="form">
            <Accordion.Control>Nomination Form</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Field label="Nominated For" value={data.nominated_for} />
                <Field label="Proceed Preference" value={PROCEED_LABELS[data.proceed_preference] || data.proceed_preference} />
                <Field label="Sphere of Influence" value={data.influence_examples} />
                <Field label="Submitted" value={data.submission_date} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Nominator */}
          <Accordion.Item value="nominator">
            <Accordion.Control>Nominator</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Field label="Name" value={data.nominator_name} />
                <SimpleGrid cols={isWide ? 2 : 1} spacing="xs">
                  <Field label="Email" value={data.nominator_email} />
                  <Field label="Phone" value={data.nominator_phone} />
                </SimpleGrid>
                <Field label="Nominator POC" value={data.poc} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          {/* Approval */}
          {(data.approval_status !== 'pending' || data.approver) && (
            <Accordion.Item value="approval">
              <Accordion.Control>Approval</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  <Field label="Status" value={data.approval_status} />
                  <Field label="Approved For" value={data.approval_detail} />
                  <Field label="Approved By" value={data.approver} />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          )}
        </Accordion>

        {/* Outreach history */}
        {data.outreach.length > 0 && (
          <>
            <Text ff="heading" fw={600} mt="xs">Outreach History</Text>
            <Timeline active={data.outreach.length} bulletSize={16} lineWidth={2}>
              {data.outreach.map((o) => (
                <Timeline.Item key={o.id} title={o.campaign || 'Campaign'}>
                  <Text size="xs" c="dimmed">{o.status}</Text>
                  {o.notes && <Text size="sm" mt={2}>{o.notes}</Text>}
                </Timeline.Item>
              ))}
            </Timeline>
          </>
        )}
      </Stack>
    </Box>
  );
}
