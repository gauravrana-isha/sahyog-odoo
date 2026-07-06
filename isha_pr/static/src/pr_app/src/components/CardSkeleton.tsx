import { Card, Group, Skeleton, Stack } from '@mantine/core';

interface CardSkeletonProps {
  /** Leading shape: 'tile' = square icon tile (programs/history),
   *  'avatar' = circle (guests/contacts). */
  leading?: 'tile' | 'avatar';
}

/** Loading placeholder that mirrors the real list-card anatomy
 *  (leading tile/avatar + title + meta lines) instead of a blank block. */
export function CardSkeleton({ leading = 'tile' }: CardSkeletonProps) {
  return (
    <Card padding="sm" withBorder>
      <Group wrap="nowrap" align="flex-start">
        {leading === 'avatar'
          ? <Skeleton height={38} circle />
          : <Skeleton height={40} width={40} radius="md" />}
        <Stack gap={8} style={{ flex: 1 }} pt={2}>
          <Skeleton height={12} width="55%" radius="sm" />
          <Skeleton height={10} width="80%" radius="sm" />
          <Skeleton height={10} width="40%" radius="sm" />
        </Stack>
      </Group>
    </Card>
  );
}
