import { Box, Text } from '@mantine/core';

/** Read-only label/value pair used across all detail pages. */
export function Field({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <Box>
      <Text size="xs" c="dimmed" mb={2}>{label}</Text>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{value || '—'}</Text>
    </Box>
  );
}
