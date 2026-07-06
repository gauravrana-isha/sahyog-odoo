import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge, Box, Card, Group, SimpleGrid, Stack, Text,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChecklist, IconChevronRight } from '@tabler/icons-react';
import { isBefore, isToday, parseISO, startOfDay, addDays } from 'date-fns';
import { apiGet } from '../api';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/CardSkeleton';
import type { Interaction } from '../types';

interface Bucket {
  key: string;
  title: string;
  color: string;
  items: Interaction[];
}

/** Split follow-ups into urgency buckets relative to today. */
function bucketize(items: Interaction[]): Bucket[] {
  const today = startOfDay(new Date());
  const weekEnd = addDays(today, 7);
  const buckets: Bucket[] = [
    { key: 'overdue', title: 'Overdue', color: 'red', items: [] },
    { key: 'today', title: 'Today', color: 'clay', items: [] },
    { key: 'week', title: 'This Week', color: 'ochre', items: [] },
    { key: 'later', title: 'Later', color: 'river', items: [] },
  ];
  for (const i of items) {
    if (!i.follow_up_date) continue;
    const d = parseISO(i.follow_up_date);
    if (isToday(d)) buckets[1].items.push(i);
    else if (isBefore(d, today)) buckets[0].items.push(i);
    else if (isBefore(d, weekEnd)) buckets[2].items.push(i);
    else buckets[3].items.push(i);
  }
  return buckets.filter((b) => b.items.length > 0);
}

export function FollowUpsPage() {
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Interaction[]>('/followups')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const buckets = bucketize(items);

  return (
    <Box style={{ maxWidth: isWide ? 1100 : undefined, margin: isWide ? '0 auto' : undefined }}>
      {loading ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} leading="avatar" />)}
        </SimpleGrid>
      ) : buckets.length === 0 ? (
        <EmptyState
          icon={IconChecklist}
          title="All caught up"
          description="Interactions with a follow-up date will appear here, grouped by urgency."
        />
      ) : (
        <Stack gap="lg">
          {buckets.map((bucket) => (
            <Box key={bucket.key}>
              <Group gap="xs" mb="sm">
                <Text ff="heading" fw={600} fz="lg">{bucket.title}</Text>
                <Badge size="sm" variant="light" color={bucket.color}>{bucket.items.length}</Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                {bucket.items.map((i, idx) => (
                  <Card
                    key={i.id}
                    padding="sm"
                    withBorder
                    shadow="xs"
                    className="sahyog-fade-up sahyog-card-interactive"
                    style={{ cursor: i.partner_id ? 'pointer' : undefined, '--stagger': idx } as CSSProperties}
                    onClick={() => i.partner_id && navigate(`/contacts/${i.partner_id.id}`)}
                  >
                    <Group wrap="nowrap" gap="sm">
                      <Box style={{ flex: 1, minWidth: 0 }}>
                        <Group justify="space-between" wrap="wrap" gap={4}>
                          <Text ff="heading" fw={600} size="md" lh={1.25}>
                            {i.partner_id?.name || 'Unknown contact'}
                          </Text>
                          <Badge size="xs" variant="light" color={bucket.color}>
                            {i.follow_up_date}
                          </Badge>
                        </Group>
                        <Text size="xs" c="dimmed" mt={2} truncate>
                          {[i.subject || i.interaction_type, i.center_id?.name, i.owner]
                            .filter(Boolean).join(' · ')}
                        </Text>
                        {i.notes && (
                          <Text size="xs" c="dimmed" mt={2} lineClamp={2}>{i.notes}</Text>
                        )}
                      </Box>
                      {i.partner_id && (
                        <IconChevronRight size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
                      )}
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
