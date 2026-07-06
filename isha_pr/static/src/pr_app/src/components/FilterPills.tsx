import { Badge, Group } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

export interface FilterPill {
  key: string;
  label: string;
  color?: string;
  onClear: () => void;
}

/** Removable pills for every active filter — the popover filters are
 *  otherwise invisible, so this row keeps the applied state honest. */
export function FilterPills({ pills }: { pills: FilterPill[] }) {
  if (pills.length === 0) return null;
  return (
    <Group gap="xs" mb="md">
      {pills.map((p) => (
        <Badge
          key={p.key}
          variant="light"
          color={p.color || 'clay'}
          rightSection={
            <IconX
              size={12}
              style={{ cursor: 'pointer' }}
              aria-label={`Clear ${p.label}`}
              onClick={p.onClear}
            />
          }
        >
          {p.label}
        </Badge>
      ))}
    </Group>
  );
}
