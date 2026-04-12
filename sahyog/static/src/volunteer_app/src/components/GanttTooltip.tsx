import { Text, Stack } from '@mantine/core';
import type { CalendarEntry } from '../types';

interface GanttTooltipProps {
  entry: CalendarEntry;
}

export function GanttTooltipContent({ entry }: GanttTooltipProps) {
  // entry.name is like "Volunteer Name — Silence Period" — extract volunteer name
  const parts = entry.name.split(' — ');
  const volunteerName = parts[0] || entry.name;

  return (
    <Stack gap={2}>
      <Text size="sm" fw={600}>{volunteerName}</Text>
      <Text size="xs">Type: {entry.entry_type}</Text>
      <Text size="xs">
        {entry.start_date} → {entry.end_date}
      </Text>
      <Text size="xs">Status: {entry.status}</Text>
    </Stack>
  );
}
