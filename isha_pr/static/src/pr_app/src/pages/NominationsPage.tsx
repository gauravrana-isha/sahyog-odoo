import { useEffect, useState, useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar, Badge, Box, Card, Group, SegmentedControl, Select, SimpleGrid,
  Text, TextInput,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconAward, IconChevronRight, IconFlame, IconSearch } from '@tabler/icons-react';
import { apiGet } from '../api';
import { STAGE_COLOR, TIER_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/CardSkeleton';
import type { NominationLight } from '../types';

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

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function NominationsPage() {
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [items, setItems] = useState<NominationLight[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState('all');
  const [tier, setTier] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback((stageF: string, tierF: string | null, search: string) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (stageF !== 'all') params.set('stage', stageF);
    if (tierF) params.set('tier', tierF);
    if (search) params.set('q', search);
    const qs = params.toString();
    apiGet<NominationLight[]>(`/nominations${qs ? `?${qs}` : ''}`)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(stage, tier, q), 250);
    return () => clearTimeout(t);
  }, [stage, tier, q, load]);

  const filtersActive = stage !== 'all' || !!tier || !!q;

  return (
    <Box style={{ maxWidth: isWide ? 1100 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <SegmentedControl
        fullWidth
        size="xs"
        mb="sm"
        value={stage}
        onChange={setStage}
        data={STAGE_FILTERS}
      />
      <Group wrap="nowrap" mb="md">
        <TextInput
          flex={1}
          leftSection={<IconSearch size={16} />}
          placeholder="Search nominee or organization…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          style={{ maxWidth: isWide ? 420 : undefined }}
        />
        <Select
          w={isWide ? 200 : 150}
          placeholder="All tiers"
          aria-label="Filter by tier"
          data={TIER_FILTERS}
          value={tier}
          onChange={setTier}
          clearable
        />
      </Group>

      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} leading="avatar" />)}
        </SimpleGrid>
      ) : items.length === 0 ? (
        <EmptyState
          icon={IconAward}
          title={filtersActive ? 'No nominations found' : 'No nominations yet'}
          description={filtersActive
            ? 'Nothing matches these filters. Try widening the stage or tier.'
            : 'Nominations submitted through the public form will appear here for review.'}
        />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {items.map((n, idx) => (
            <Card
              key={n.id}
              padding="sm"
              withBorder
              shadow="xs"
              className="sahyog-fade-up sahyog-card-interactive"
              style={{ cursor: 'pointer', '--stagger': idx } as CSSProperties}
              onClick={() => navigate(`/nominations/${n.id}`)}
            >
              <Group wrap="nowrap" gap="sm">
                <Avatar radius="xl" color="clay" size={38} src={n.image_url}>
                  {initials(n.nominee)}
                </Avatar>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" wrap="wrap" gap={4}>
                    <Group gap={6}>
                      <Text ff="heading" fw={600} size="md" lh={1.25}>{n.nominee}</Text>
                      {n.high_priority && <IconFlame size={16} color="var(--mantine-color-clay-6)" />}
                    </Group>
                    <Group gap={4}>
                      {n.tier && (
                        <Badge size="xs" variant="light" color={TIER_COLOR[n.tier] || 'sand'}>
                          Tier {n.tier}
                        </Badge>
                      )}
                      <Badge size="xs" variant="light" color={STAGE_COLOR[n.stage] || 'sand'}>
                        {n.stage_label || n.stage}
                      </Badge>
                    </Group>
                  </Group>
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
                </Box>
                <IconChevronRight size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
