import type { CSSProperties, ReactNode } from 'react';
import { Box, Card, Group, Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';

interface EntityCardProps {
  /** Leading visual — an Avatar or IconTile. */
  leading?: ReactNode;
  title: string;
  /** Inline extras next to the title (VIP badge, priority flame…). */
  titleExtras?: ReactNode;
  /** Right-aligned badges on the title row. */
  badges?: ReactNode;
  /** Dimmed meta content below the title row. */
  meta?: ReactNode;
  onClick?: () => void;
  /** Index for the staggered entrance animation. */
  stagger?: number;
}

/** The standard list card: leading visual + serif title + badges + meta,
 *  with hover-lift and chevron affordance when clickable. */
export function EntityCard({ leading, title, titleExtras, badges, meta, onClick, stagger = 0 }: EntityCardProps) {
  return (
    <Card
      padding="sm"
      withBorder
      shadow="xs"
      className={`sahyog-fade-up${onClick ? ' sahyog-card-interactive' : ''}`}
      style={{ cursor: onClick ? 'pointer' : undefined, '--stagger': stagger } as CSSProperties}
      onClick={onClick}
    >
      <Group wrap="nowrap" gap="sm" align={leading ? 'center' : 'flex-start'}>
        {leading}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="wrap" gap={4}>
            <Group gap={6} wrap="nowrap">
              <Text ff="heading" fw={600} size="md" lh={1.25}>{title}</Text>
              {titleExtras}
            </Group>
            {badges && <Group gap={4}>{badges}</Group>}
          </Group>
          {meta}
        </Box>
        {onClick && (
          <IconChevronRight size={18} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
        )}
      </Group>
    </Card>
  );
}
