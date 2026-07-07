import { useState } from 'react';
import { Button, Group, Modal, Text, ThemeIcon } from '@mantine/core';
import { IconArchive, IconArchiveOff, IconTrash, IconAlertTriangle } from '@tabler/icons-react';

// "2026-07-07 12:34:56" -> "2026-07-07 12:34"
function fmt(s: string): string {
  return s ? s.slice(0, 16).replace('T', ' ') : '';
}

/** Detail-page footer: created/updated audit trail + Archive/Restore (any PR user)
 *  and Delete (admins only — permanent, behind a confirm modal). Shared by
 *  Collaboration + Nomination. */
export function RecordFooter({
  active, createdBy, createdAt, updatedBy, updatedAt, isAdmin, busy,
  entityName = 'record', onArchiveToggle, onDelete,
}: {
  active: boolean;
  createdBy: string; createdAt: string; updatedBy: string; updatedAt: string;
  isAdmin: boolean; busy?: string | null; entityName?: string;
  onArchiveToggle: () => void; onDelete: () => void | Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const runDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();       // navigates away on success; toasts on error
    } finally {
      setDeleting(false);
      setConfirm(false);
    }
  };

  const audit = [
    createdBy && `Created by ${createdBy}${createdAt ? ` · ${fmt(createdAt)}` : ''}`,
    updatedBy && `Updated by ${updatedBy}${updatedAt ? ` · ${fmt(updatedAt)}` : ''}`,
  ].filter(Boolean).join('     ·     ');

  return (
    <>
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
              leftSection={<IconTrash size={14} />} onClick={() => setConfirm(true)}>
              Delete
            </Button>
          )}
        </Group>
      </Group>

      <Modal opened={confirm} onClose={() => !deleting && setConfirm(false)} centered
        title={<Text fw={700}>Delete this {entityName}?</Text>}>
        <Group gap="sm" wrap="nowrap" align="flex-start" mb="lg">
          <ThemeIcon color="red" variant="light" radius="xl" size="lg">
            <IconAlertTriangle size={18} />
          </ThemeIcon>
          <Text size="sm">
            This permanently deletes the {entityName} — including its AI evaluation and
            sources — and <b>can&apos;t be undone</b>. Consider <b>Archive</b> instead: it
            hides the record from lists but keeps the full history, and you can restore it
            anytime.
          </Text>
        </Group>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => setConfirm(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="red" leftSection={<IconTrash size={14} />} loading={deleting} onClick={runDelete}>
            Delete permanently
          </Button>
        </Group>
      </Modal>
    </>
  );
}
