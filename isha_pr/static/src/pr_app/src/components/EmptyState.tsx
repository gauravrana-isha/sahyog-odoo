import type { ComponentType, ReactNode } from 'react';
import { Center, Stack, Text } from '@mantine/core';

interface EmptyStateProps {
  icon: ComponentType<{ size?: number | string; stroke?: number | string; color?: string }>;
  title: string;
  description?: string;
  /** Optional call-to-action rendered under the description. */
  action?: ReactNode;
}

/** Standard empty state: contextual icon in a warm halo, serif title,
 *  dimmed description. Use instead of ad-hoc IconMoodEmpty blocks. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <Center py={48}>
      <Stack align="center" gap="sm">
        <Center
          w={72}
          h={72}
          style={{
            borderRadius: '50%',
            backgroundColor: 'light-dark(var(--mantine-color-sand-1), var(--mantine-color-dark-6))',
          }}
        >
          <Icon size={30} stroke={1.5} color="var(--mantine-color-clay-5)" />
        </Center>
        <Text ff="heading" fw={600} fz="lg" ta="center">{title}</Text>
        {description && (
          <Text size="sm" c="dimmed" ta="center" maw={300}>{description}</Text>
        )}
        {action}
      </Stack>
    </Center>
  );
}
