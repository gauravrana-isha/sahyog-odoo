import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Card, Group, Progress, SimpleGrid, Stack, Text, ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import { AreaChart, BarChart, DonutChart } from '@mantine/charts';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconStar, IconFlask, IconSeeding, IconAlertTriangle, IconPhone, IconChevronRight,
  IconMicrophone,
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
  const isWide = useMediaQuery('(min-width: 768px)');
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

  // Each tile drills into the nominations list with the SAME filter its
  // number was computed from (see pr_dashboard + the priority/flag params).
  const tiles = [
    { label: 'Priority Leads', value: d.priority_leads, icon: IconStar, color: 'sage', to: '/nominations?priority=1' },
    { label: 'To Research', value: d.to_research, icon: IconFlask, color: 'ochre', to: '/nominations?stage=nominated' },
    { label: 'Nurturing', value: d.nurturing, icon: IconSeeding, color: 'clay', to: '/nominations?stage=nurturing' },
    { label: 'Needs Review', value: d.needs_review, icon: IconAlertTriangle, color: 'red', to: '/nominations?flag=review' },
  ];

  return (
    <Stack p="md" pb={90} gap="md" maw={isWide ? 1200 : 860} mx="auto">
      <div>
        <Text fw={700} size="xl">Outreach Dashboard</Text>
        <Text c="dimmed" size="sm">
          {d.total.toLocaleString()} nominees · {d.with_outreach.toLocaleString()} with calling history
        </Text>
      </div>

      {/* Priority hero + stat tiles — side by side on desktop */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder radius="lg" p="lg" h="100%"
          style={{ background: 'var(--mantine-color-sage-light)', cursor: 'pointer' }}
          onClick={() => navigate('/nominations?priority=1')}>
          <Group justify="space-between" align="flex-start" h="100%">
            <div>
              <Group gap={8}><IconStar size={20} /><Text fw={600}>Priority Leads to re-engage</Text></Group>
              <Text fw={800} style={{ fontSize: 44, lineHeight: 1.1 }}>{d.priority_leads.toLocaleString()}</Text>
              <Text size="sm" c="dimmed">Tier 1 or High Priority, not rejected</Text>
            </div>
            <IconChevronRight />
          </Group>
        </Card>

        <SimpleGrid cols={2} spacing="sm">
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
      </SimpleGrid>

      {/* Pipeline, charts & shortcuts — two columns on desktop */}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md" style={{ alignItems: 'start' }}>
        <Card withBorder radius="md" p="md">
          <Text fw={600} mb="sm">Pipeline</Text>
          <Stack gap="xs">
            {STAGE_ORDER.map((s) => (
              <UnstyledButton key={s} onClick={() => navigate(`/nominations?stage=${s}`)}>
                <Group justify="space-between" mb={2}>
                  <Text size="sm">{STAGE_LABEL[s]}</Text>
                  <Text size="sm" fw={600}>{(d.by_stage[s] || 0).toLocaleString()}</Text>
                </Group>
                <Progress value={((d.by_stage[s] || 0) / stageMax) * 100}
                  color={STAGE_COLOR[s]} size="lg" radius="sm" />
              </UnstyledButton>
            ))}
          </Stack>
        </Card>

        <Card withBorder radius="md" p="md">
          <Text fw={600} mb="sm">By Tier</Text>
          <Group justify="center">
            <DonutChart
              size={170}
              thickness={26}
              withLabelsLine={false}
              chartLabel={`${tierTotal.toLocaleString()} tiered`}
              tooltipDataSource="segment"
              data={(['1', '2', '3'] as const).map((t) => ({
                name: TIER_LABEL[t],
                value: d.by_tier[t] || 0,
                color: `${TIER_COLOR[t]}.6`,
              }))}
              pieProps={{
                style: { cursor: 'pointer' },
                // Segment order matches tiers 1..3 — drill into that tier
                onClick: (_seg: unknown, index: number) => navigate(`/nominations?tier=${index + 1}`),
              }}
            />
          </Group>
        </Card>

        <Card withBorder radius="md" p="md">
          <Text fw={600} mb="sm">Nominations per Month</Text>
          {d.by_month.length === 0 ? (
            <Text size="sm" c="dimmed" py="lg" ta="center">No dated submissions yet.</Text>
          ) : (
            <AreaChart
              h={170}
              data={d.by_month}
              dataKey="month"
              series={[{ name: 'count', label: 'Nominations', color: 'clay.6' }]}
              curveType="monotone"
              withDots={false}
              gridAxis="x"
              style={{ cursor: 'pointer' }}
              areaChartProps={{
                // Click a month → that month's submissions in the list
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick: (state: any) => {
                  const key = state?.activePayload?.[0]?.payload?.key;
                  if (key) navigate(`/nominations?month=${key}`);
                },
              }}
            />
          )}
        </Card>

        {/* Top verticals */}
        <Card withBorder radius="md" p="md">
          <Text fw={600} mb="sm">Top Verticals</Text>
          <BarChart
            h={40 * Math.max(1, d.top_verticals.length)}
            data={d.top_verticals.map((v) => ({ label: v.label, count: v.count, key: v.vertical }))}
            dataKey="label"
            orientation="vertical"
            series={[{ name: 'count', label: 'Nominations', color: 'river.5' }]}
            gridAxis="none"
            withXAxis={false}
            yAxisProps={{ width: 190 }}
            barProps={{
              radius: 4,
              style: { cursor: 'pointer' },
              // Click a bar → that vertical in the list
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick: (bar: any) => {
                const key = bar?.payload?.key ?? bar?.key;
                if (key) navigate(`/nominations?vertical=${key}`);
              },
            }}
          />
        </Card>

        <UnstyledButton onClick={() => navigate('/follow-ups')} style={{ width: '100%' }}>
          <Card withBorder radius="md" p="md">
            <Group justify="space-between">
              <Group gap={8}><IconPhone size={18} /><Text fw={600}>Follow-ups</Text></Group>
              <IconChevronRight />
            </Group>
          </Card>
        </UnstyledButton>

        {d.collabs && d.collabs.total > 0 && (
          <UnstyledButton onClick={() => navigate('/collabs')} style={{ width: '100%' }}>
            <Card withBorder radius="md" p="md">
              <Group justify="space-between">
                <Group gap={8}><IconMicrophone size={18} /><Text fw={600}>Collaboration Requests</Text></Group>
                <Group gap={6}>
                  {d.collabs.to_decide > 0 && <Badge color="ochre" variant="light">{d.collabs.to_decide} to decide</Badge>}
                  {d.collabs.high_risk > 0 && <Badge color="red" variant="light">{d.collabs.high_risk} high risk</Badge>}
                  <IconChevronRight />
                </Group>
              </Group>
            </Card>
          </UnstyledButton>
        )}
      </SimpleGrid>
    </Stack>
  );
}
