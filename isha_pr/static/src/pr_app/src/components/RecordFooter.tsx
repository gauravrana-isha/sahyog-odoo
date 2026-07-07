import { Button, Group, Text } from '@mantine/core';
import { IconArchive, IconArchiveOff, IconTrash } from '@tabler/icons-react';

// "2026-07-07 12:34:56" -> "2026-07-07 12:34"
function fmt(s: string): string {
  return s ? s.slice(0, 16).replace('T', ' ') : '';
}

/** Detail-page footer: created/updated audit trail + Archive/Restore (any PR user)
 *  and Delete (admins only — permanent). Shared by Collaboration + Nomination. */
export function RecordFooter({
  active, createdBy, createdAt, updatedBy, updatedAt, isAdmin, busy,
  onArchiveToggle, onDelete,
}: {
  active: boolean;
  createdBy: string; createdAt: string; updatedBy: string; updatedAt: string;
  isAdmin: boolean; busy?: string | null;
  onArchiveToggle: () => void; onDelete: () => void;
}) {
  const audit = [
    createdBy && `Created by ${createdBy}${createdAt ? ` · ${fmt(createdAt)}` : ''}`,
    updatedBy && `Updated by ${updatedBy}${updatedAt ? ` · ${fmt(updatedAt)}` : ''}`,
  ].filter(Boolean).join('     ·     ');
  return (
    <Group justify="space-between" mt="lg" pt="md" wrap="wrap"
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
      <Text size="xs" c="dimmed">{audit}</Text>
      <Group gap="xs">
        <Button size="compact-sm" variant="subtle" color="gray"
          leftSection={active ? <IconArchive size={14} /> : <IconArchiveOff size={14} />}
          loading={busy === 'archive' || busy === 'unarchive'} onClick={onArchiveToggle}>
          {active ? 'Archive' : 'Restore'}
        </Button>
        {isAdmin && (
          <Button size="compact-sm" variant="subtle" color="red"
            leftSection={<IconTrash size={14} />} onClick={onDelete}>
            Delete
          </Button>
        )}
      </Group>
    </Group>
  );
}
