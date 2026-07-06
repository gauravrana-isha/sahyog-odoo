import type { ReactNode } from 'react';
import { Card, Group, Text } from '@mantine/core';

/** A titled bordered card used to lay detail-page sections out in a grid on
 *  desktop (where an accordion would waste horizontal space). Module-scoped so
 *  its identity is stable — defining it inside a page component would remount
 *  its input children on every keystroke and drop focus. */
export function SectionCard({ title, icon, children }: {
  title: string; icon?: ReactNode; children: ReactNode;
}) {
  return (
    <Card withBorder radius="md" p="md">
      <Group gap={8} mb="sm">{icon}<Text fw={700} size="sm">{title}</Text></Group>
      {children}
    </Card>
  );
}
