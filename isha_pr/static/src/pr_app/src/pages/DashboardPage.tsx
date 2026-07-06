import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, Group, Progress, SimpleGrid, Stack, Text, ThemeIcon, Badge,
  UnstyledButton,
} from '@mantine/core';
import {
  IconStar, IconFlask, IconSeeding, IconAlertTriangle, IconPhone, IconChevronRight,
} from '@tabler/icons-react';
import { apiGet } from '../api';
import { STAGE_COLOR, TIER_COLOR } from '../tokens';
import { CardSkeleton } from '../components/CardSkeleton';
import type { DashboardData } from '../types';

const STAGE_ORDER = ['nominated', 'researched', 'approved', 'nurturing'];
const STAGE_LABEL: Record<string, string> = {
  nominated: 'Nominated', researched: 'Researched', approved: 'Approved',
  nurturing: 'Nurturing', rejected: 'Rejected',
};
const TIER_LABEL: Record<string, string> = {
  '1': 'Tier 1 — Priority', '2': 'Tier 2 — Review', '3': 'Tier 3 — Low',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [d, setD] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<DashboardData>('/dashboard')
      .then(setD).catch(() => setD(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Stack p="md"><CardSkeleton /><CardSkeleton /></Stack>;
  if (!d) return <Text p="md" c="dimmed">Could not load the dashboard.</Text>;

  const stageMax = Math.max(1, ...STAGE_ORDER.map((s) => d.by_stage[s] || 0));
  const tierTotal = Math.max(1, (d.by_tier['1'] || 0) + (d.by_tier['2'] || 0) + (d.by_tier['3'] || 0));

  const tiles = [
    { label: 'Priority Leads', value: d.priority_leads, icon: IconStar, color: 'sage', to: '/nominations' },
    { label: 'To Research', value: d.to_research, icon: IconFlask, color: 'ochre', to: '/nominations' },
    { label: 'Nurturing', value: d.nurturing, icon: IconSeeding, color: 'clay', to: '/nominations' },
    { label: 'Needs Review', value: d.needs_review, icon: IconAlertTriangle, color: 'red', to: '/nominations' },
  ];

  return (
    <Stack p="md" pb={90} gap="md" maw={860} mx="auto">
      <div>
        <Text fw={700} size="xl">Outreach Dashboard</Text>
        <Text c="dimmed" size="sm">
          {d.total.toLocaleString()} nominees · {d.with_outreach.toLocaleString()} with calling history
        </Text>
      </div>

      {/* Priority hero */}
      <Card withBorder radius="lg" p="lg"
        style={{ background: 'var(--mantine-color-sage-light)', cursor: 'pointer' }}
        onClick={() => navigate('/nominations')}>
        <Group justify="space-between" align="flex-start">
          <div>
            <Group gap={8}><IconStar size={20} /><Text fw={600}>Priority Leads to re-engage</Text></Group>
            <Text fw={800} style={{ fontSize: 44, lineHeight: 1.1 }}>{d.priority_leads.toLocaleString()}</Text>
            <Text size="sm" c="dimmed">Tier 1 or High Priority, not rejected</Text>
          </div>
          <IconChevronRight />
        </Group>
      </Card>

      {/* Stat tiles */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {tiles.map((t) => (
          <UnstyledButton key={t.label} onClick={() => navigate(t.to)}>
            <Card withBorder radius="md" p="md" h="100%">
              <ThemeIcon variant="light" color={t.color} radius="md" size="lg" mb={8}>
                <t.icon size={18} />
              </ThemeIcon>
              <Text fw={800} size="28px" lh={1}>{t.value.toLocaleString()}</Text>
              <Text size="sm" c="dimmed">{t.label}</Text>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>

      {/* Pipeline funnel */}
      <Card withBorder radius="md" p="md">
        <Text fw={600} mb="sm">Pipeline</Text>
        <Stack gap="xs">
          {STAGE_ORDER.map((s) => (
            <div key={s}>
              <Group justify="space-between" mb={2}>
                <Text size="sm">{STAGE_LABEL[s]}</Text>
                <Text size="sm" fw={600}>{(d.by_stage[s] || 0).toLocaleString()}</Text>
              </Group>
              <Progress value={((d.by_stage[s] || 0) / stageMax) * 100}
                color={STAGE_COLOR[s]} size="lg" radius="sm" />
            </div>
          ))}
        </Stack>
      </Card>

      {/* Tier breakdown */}
      <Card withBorder radius="md" p="md">
        <Text fw={600} mb="sm">By Tier</Text>
        <Progress.Root size={26} radius="sm" mb="xs">
          {(['1', '2', '3'] as const).map((t) => (
            <Progress.Section key={t} value={((d.by_tier[t] || 0) / tierTotal) * 100}
              color={TIER_COLOR[t]}>
              <Progress.Label>{d.by_tier[t] || 0}</Progress.Label>
            </Progress.Section>
          ))}
        </Progress.Root>
        <Group gap="lg">
          {(['1', '2', '3'] as const).map((t) => (
            <Group key={t} gap={6}>
              <Box w={10} h={10} style={{ borderRadius: 2, background: `var(--mantine-color-${TIER_COLOR[t]}-6)` }} />
              <Text size="xs" c="dimmed">{TIER_LABEL[t]}</Text>
            </Group>
          ))}
        </Group>
      </Card>

      {/* Top verticals */}
      <Card withBorder radius="md" p="md">
        <Text fw={600} mb="sm">Top Verticals</Text>
        <Stack gap={6}>
          {d.top_verticals.map((v) => (
            <Group key={v.vertical} justify="space-between">
              <Text size="sm">{v.label}</Text>
              <Badge variant="light" color="river">{v.count.toLocaleString()}</Badge>
            </Group>
          ))}
        </Stack>
      </Card>

      <UnstyledButton onClick={() => navigate('/follow-ups')}>
        <Card withBorder radius="md" p="md">
          <Group justify="space-between">
            <Group gap={8}><IconPhone size={18} /><Text fw={600}>Follow-ups</Text></Group>
            <IconChevronRight />
          </Group>
        </Card>
      </UnstyledButton>
    </Stack>
  );
}
