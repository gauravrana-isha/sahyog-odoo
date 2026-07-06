import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Box, Card, Group, SegmentedControl, Select, SimpleGrid,
  Stack, Table, Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconAward, IconFlame } from '@tabler/icons-react';
import { apiGet } from '../api';
import { STAGE_COLOR, TIER_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/CardSkeleton';
import { EntityCard } from '../components/EntityCard';
import { ListToolbar } from '../components/ListToolbar';
import { ListPager } from '../components/ListPager';
import type { NominationLight, Paged } from '../types';

const STAGE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Nominated', value: 'nominated' },
  { label: 'Researched', value: 'researched' },
  { label: 'Approved', value: 'approved' },
  { label: 'Nurturing', value: 'nurturing' },
  { label: 'Rejected', value: 'rejected' },
];

const TIER_FILTERS = [
  { value: '1', label: 'Tier 1 — Priority' },
  { value: '2', label: 'Tier 2 — Review' },
  { value: '3', label: 'Tier 3 — Low' },
];

const SORT_OPTIONS = [
  { value: 'tier', label: 'Tier (priority first)' },
  { value: 'newest', label: 'Newest first' },
  { value: 'name', label: 'Name (A–Z)' },
];

const GROUP_OPTIONS = [
  { value: 'none', label: 'No grouping' },
  { value: 'stage', label: 'Stage' },
  { value: 'vertical', label: 'Vertical' },
];

const STAGE_ORDER = ['nominated', 'researched', 'approved', 'nurturing', 'rejected'];
const STAGE_LABELS: Record<string, string> = {
  nominated: 'Nominated', researched: 'Researched', approved: 'Approved',
  nurturing: 'Nurturing', rejected: 'Rejected',
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function NominationsPage() {
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [items, setItems] = useState<NominationLight[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('all');
  const [tier, setTier] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('tier');
  const [groupBy, setGroupBy] = useState('none');
  const [view, setView] = useState('cards');

  const load = useCallback((stageF: string, tierF: string | null, search: string, order: string, off: number, lim: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (stageF !== 'all') params.set('stage', stageF);
    if (tierF) params.set('tier', tierF);
    if (search) params.set('q', search);
    params.set('order', order);
    params.set('offset', String(off));
    params.set('limit', String(lim));
    apiGet<Paged<NominationLight>>(`/nominations?${params.toString()}`)
      .then((r) => { setItems(r.records); setTotal(r.total); })
      .catch(() => { setItems([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(stage, tier, q, sort, offset, limit), 250);
    return () => clearTimeout(t);
  }, [stage, tier, q, sort, offset, limit, load]);

  // Any change of search/filter/sort restarts from the first page.
  const setStageReset = (v: string) => { setStage(v); setOffset(0); };
  const setTierReset = (v: string | null) => { setTier(v); setOffset(0); };
  const setQReset = (v: string) => { setQ(v); setOffset(0); };
  const setSortReset = (v: string) => { setSort(v); setOffset(0); };

  // Sorting is server-side (order param); grouping applies within the page.
  const groups = useMemo(() => {
    if (groupBy === 'stage') {
      return STAGE_ORDER
        .map((s) => ({
          key: s,
          title: STAGE_LABELS[s],
          items: items.filter((n) => n.stage === s),
        }))
        .filter((g) => g.items.length > 0);
    }
    if (groupBy === 'vertical') {
      const verticals = [...new Set(items.map((n) => n.vertical_label || 'No vertical'))];
      return verticals.map((v) => ({
        key: v,
        title: v,
        items: items.filter((n) => (n.vertical_label || 'No vertical') === v),
      }));
    }
    return [{ key: 'all', title: '', items }];
  }, [items, groupBy]);

  const filtersActive = stage !== 'all' || !!tier || !!q;

  const nominationCard = (n: NominationLight, idx: number) => (
    <EntityCard
      key={n.id}
      stagger={idx}
      onClick={() => navigate(`/nominations/${n.id}`)}
      leading={
        <Avatar radius="xl" color="clay" size={38} src={n.image_url}>
          {initials(n.nominee)}
        </Avatar>
      }
      title={n.nominee}
      titleExtras={n.high_priority && <IconFlame size={16} color="var(--mantine-color-clay-6)" />}
      badges={
        <>
          {n.tier && (
            <Badge size="xs" variant="light" color={TIER_COLOR[n.tier] || 'sand'}>Tier {n.tier}</Badge>
          )}
          <Badge size="xs" variant="light" color={STAGE_COLOR[n.stage] || 'sand'}>
            {n.stage_label || n.stage}
          </Badge>
        </>
      }
      meta={
        <>
          <Text size="xs" c="dimmed" mt={2} truncate>
            {[n.leadership_position, n.organization].filter(Boolean).join(' · ') || '—'}
          </Text>
          <Group gap={6} mt={4}>
            {n.vertical_label && (
              <Badge size="xs" variant="light" color="river">{n.vertical_label}</Badge>
            )}
            {n.is_self_nomination && (
              <Badge size="xs" variant="light" color="ochre">Self</Badge>
            )}
            {n.submission_date && (
              <Text size="xs" c="dimmed">{n.submission_date}</Text>
            )}
          </Group>
        </>
      }
    />
  );

  const nominationsTable = (rows: NominationLight[]) => (
    <Card withBorder padding={0} className="sahyog-fade-up">
      <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nominee</Table.Th>
            <Table.Th>Role / Organization</Table.Th>
            <Table.Th>Tier</Table.Th>
            <Table.Th>Vertical</Table.Th>
            <Table.Th>Stage</Table.Th>
            <Table.Th>Submitted</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((n) => (
            <Table.Tr key={n.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/nominations/${n.id}`)}>
              <Table.Td>
                <Group gap="sm" wrap="nowrap">
                  <Avatar radius="xl" color="clay" size={28} src={n.image_url}>
                    {initials(n.nominee)}
                  </Avatar>
                  <Text fw={600} size="sm">{n.nominee}</Text>
                  {n.high_priority && <IconFlame size={14} color="var(--mantine-color-clay-6)" />}
                </Group>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed" lineClamp={1}>
                  {[n.leadership_position, n.organization].filter(Boolean).join(' · ') || '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                {n.tier
                  ? <Badge size="xs" variant="light" color={TIER_COLOR[n.tier] || 'sand'}>T{n.tier}</Badge>
                  : <Text size="sm" c="dimmed">—</Text>}
              </Table.Td>
              <Table.Td><Text size="sm" c="dimmed">{n.vertical_label || '—'}</Text></Table.Td>
              <Table.Td>
                <Badge size="xs" variant="light" color={STAGE_COLOR[n.stage] || 'sand'}>
                  {n.stage_label || n.stage}
                </Badge>
              </Table.Td>
              <Table.Td><Text size="sm" c="dimmed">{n.submission_date || '—'}</Text></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );

  const showTable = isWide && view === 'table';

  return (
    <Box style={{ maxWidth: isWide ? 1100 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <SegmentedControl
        fullWidth
        size="xs"
        mb="sm"
        value={stage}
        onChange={setStageReset}
        data={STAGE_FILTERS}
      />
      <ListToolbar
        search={q}
        onSearch={setQReset}
        searchPlaceholder="Search nominee or organization…"
        filters={
          <Select
            w={isWide ? 190 : undefined}
            placeholder="All tiers"
            aria-label="Filter by tier"
            data={TIER_FILTERS}
            value={tier}
            onChange={setTierReset}
            clearable
          />
        }
        sort={{ value: sort, onChange: setSortReset, options: SORT_OPTIONS }}
        groupBy={{ value: groupBy, onChange: setGroupBy, options: GROUP_OPTIONS }}
        view={{ value: view, onChange: setView }}
        count={loading ? undefined : { shown: total, label: total === 1 ? 'nomination' : 'nominations' }}
      />

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} leading="avatar" />)}
        </SimpleGrid>
      ) : total === 0 ? (
        <EmptyState
          icon={IconAward}
          title={filtersActive ? 'No nominations found' : 'No nominations yet'}
          description={filtersActive
            ? 'Nothing matches these filters. Try widening the stage or tier.'
            : 'Nominations submitted through the public form will appear here for review.'}
        />
      ) : (
        <Stack gap="lg">
          {groups.map((g) => (
            <Box key={g.key}>
              {g.title && (
                <Group gap="xs" mb="sm">
                  <Text ff="heading" fw={600} fz="lg">{g.title}</Text>
                  <Badge size="sm" variant="light" color={STAGE_COLOR[g.key] || 'river'}>{g.items.length}</Badge>
                </Group>
              )}
              {showTable ? nominationsTable(g.items) : (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {g.items.map(nominationCard)}
                </SimpleGrid>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {!loading && (
        <ListPager
          total={total}
          offset={offset}
          limit={limit}
          onChange={(o, l) => { setOffset(o); setLimit(l); }}
        />
      )}
    </Box>
  );
}
