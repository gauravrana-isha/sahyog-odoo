import type { ReactNode } from 'react';
import {
  ActionIcon, Box, Group, Menu, SegmentedControl, Text, TextInput, Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowsSort, IconCheck, IconLayoutGrid, IconSearch, IconStack2, IconTable,
} from '@tabler/icons-react';

export interface ToolbarOption {
  value: string;
  label: string;
}

interface OptionControl {
  value: string;
  onChange: (v: string) => void;
  options: ToolbarOption[];
}

interface ListToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  /** Filter controls (Selects). Inline on desktop, own row on mobile. */
  filters?: ReactNode;
  sort?: OptionControl;
  groupBy?: OptionControl;
  /** Cards ⇄ table toggle — rendered on desktop only. */
  view?: { value: string; onChange: (v: string) => void };
  /** Result count line, e.g. { shown: 42, label: 'contacts' }. */
  count?: { shown: number; label: string };
  /** Trailing action, e.g. the New button. */
  trailing?: ReactNode;
}

function OptionMenu({ icon, label, control }: { icon: ReactNode; label: string; control: OptionControl }) {
  const active = control.options.find((o) => o.value === control.value);
  return (
    <Menu shadow="md" position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label={`${label}: ${active?.label ?? '—'}`} openDelay={400}>
          <ActionIcon variant="default" size="lg" aria-label={label}>{icon}</ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{label}</Menu.Label>
        {control.options.map((o) => (
          <Menu.Item
            key={o.value}
            onClick={() => control.onChange(o.value)}
            rightSection={control.value === o.value ? <IconCheck size={14} /> : undefined}
          >
            {o.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/** The standard list-page toolbar: search, filters, sort, group-by and a
 *  cards/table view toggle, collapsing gracefully on mobile. */
export function ListToolbar({
  search, onSearch, searchPlaceholder = 'Search…',
  filters, sort, groupBy, view, count, trailing,
}: ListToolbarProps) {
  const isWide = useMediaQuery('(min-width: 768px)');

  return (
    <Box mb="md">
      <Group wrap="nowrap" gap="xs">
        <TextInput
          flex={1}
          leftSection={<IconSearch size={16} />}
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearch(e.currentTarget.value)}
          style={{ maxWidth: isWide ? 420 : undefined }}
        />
        {isWide && filters}
        {sort && <OptionMenu icon={<IconArrowsSort size={18} />} label="Sort by" control={sort} />}
        {groupBy && <OptionMenu icon={<IconStack2 size={18} />} label="Group by" control={groupBy} />}
        {isWide && view && (
          <SegmentedControl
            size="xs"
            value={view.value}
            onChange={view.onChange}
            data={[
              { value: 'cards', label: <IconLayoutGrid size={16} style={{ display: 'block' }} /> },
              { value: 'table', label: <IconTable size={16} style={{ display: 'block' }} /> },
            ]}
          />
        )}
        {trailing}
      </Group>
      {!isWide && filters && (
        <Group mt="xs" gap="xs" grow>
          {filters}
        </Group>
      )}
      {count && (
        <Text size="xs" c="dimmed" mt={6}>
          {count.shown} {count.label}
        </Text>
      )}
    </Box>
  );
}
