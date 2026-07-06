import type { ReactNode } from 'react';
import {
  ActionIcon, Box, Group, Indicator, Menu, Popover, SegmentedControl, Stack,
  Text, TextInput, Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconArrowsSort, IconCheck, IconColumns, IconFilter, IconLayoutGrid,
  IconSearch, IconStack2, IconTable,
} from '@tabler/icons-react';

export interface ToolbarOption {
  value: string;
  label: string;
}

interface OptionControl {
  value: string;
  onChange: (v: string) => void;
  options: ToolbarOption[];
  /** Multi mode: `value` is a comma-joined ordered list; clicking an option
   *  toggles it and `onChange` receives the clicked option's value. Selecting
   *  a second entry while one is active nests it (order = selection order). */
  multi?: boolean;
}

interface ListToolbarProps {
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  /** Filter controls, shown in a popover behind the funnel icon. */
  filters?: ReactNode;
  /** Number of active filters — badges the funnel icon. */
  activeFilterCount?: number;
  /** Sort menu — hidden automatically in table view (headers sort there). */
  sort?: OptionControl;
  groupBy?: OptionControl;
  /** Cards ⇄ table toggle — rendered on desktop only. */
  view?: { value: string; onChange: (v: string) => void };
  /** Column visibility menu — rendered in table view only. */
  columns?: {
    options: ToolbarOption[];
    hidden: string[];
    onToggle: (id: string) => void;
  };
  /** Result count line, e.g. { shown: 42, label: 'contacts' }. */
  count?: { shown: number; label: string };
  /** Trailing action, e.g. the New button. */
  trailing?: ReactNode;
}

function OptionMenu({ icon, label, control }: { icon: ReactNode; label: string; control: OptionControl }) {
  const activeList = control.value ? control.value.split(',') : [];
  const activeLabels = activeList
    .map((v) => control.options.find((o) => o.value === v)?.label)
    .filter(Boolean)
    .join(' → ');
  return (
    <Menu shadow="md" position="bottom-end" withinPortal closeOnItemClick={!control.multi}>
      <Menu.Target>
        <Tooltip label={`${label}: ${activeLabels || '—'}`} openDelay={400}>
          <ActionIcon
            variant={control.multi && activeList.length ? 'light' : 'default'}
            color={control.multi && activeList.length ? 'clay' : undefined}
            size="lg"
            aria-label={label}
          >
            {icon}
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{label}{control.multi ? ' (pick more to nest)' : ''}</Menu.Label>
        {control.options.map((o) => {
          const index = activeList.indexOf(o.value);
          return (
            <Menu.Item
              key={o.value}
              onClick={() => control.onChange(o.value)}
              rightSection={
                control.multi
                  ? (index >= 0 ? (
                      <Text size="10px" fw={700} c="clay">
                        {activeList.length > 1 ? index + 1 : <IconCheck size={14} />}
                      </Text>
                    ) : undefined)
                  : (control.value === o.value ? <IconCheck size={14} /> : undefined)
              }
            >
              {o.label}
            </Menu.Item>
          );
        })}
      </Menu.Dropdown>
    </Menu>
  );
}

/** The standard list-page toolbar: search, a filters popover, sort (cards
 *  view only — table headers own sorting), group-by and a cards/table view
 *  toggle. Collapses gracefully on mobile. */
export function ListToolbar({
  search, onSearch, searchPlaceholder = 'Search…',
  filters, activeFilterCount = 0, sort, groupBy, view, columns, count, trailing,
}: ListToolbarProps) {
  const isWide = useMediaQuery('(min-width: 768px)');
  const tableActive = isWide && view?.value === 'table';

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
        {filters && (
          <Popover shadow="md" position="bottom-end" width={280} withinPortal>
            <Popover.Target>
              <Tooltip label="Filters" openDelay={400}>
                <ActionIcon variant="default" size="lg" aria-label="Filters">
                  <Indicator
                    disabled={activeFilterCount === 0}
                    label={String(activeFilterCount)}
                    size={16}
                    color="clay"
                    offset={2}
                    styles={{ indicator: { padding: '0 4px', minWidth: 16, height: 16, fontSize: 10 } }}
                  >
                    <IconFilter size={18} />
                  </Indicator>
                </ActionIcon>
              </Tooltip>
            </Popover.Target>
            <Popover.Dropdown>
              <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb="xs" style={{ letterSpacing: '0.05em' }}>
                Filters
              </Text>
              <Stack gap="sm">{filters}</Stack>
            </Popover.Dropdown>
          </Popover>
        )}
        {sort && !tableActive && (
          <OptionMenu icon={<IconArrowsSort size={18} />} label="Sort by" control={sort} />
        )}
        {groupBy && <OptionMenu icon={<IconStack2 size={18} />} label="Group by" control={groupBy} />}
        {columns && tableActive && (
          <Menu shadow="md" position="bottom-end" withinPortal closeOnItemClick={false}>
            <Menu.Target>
              <Tooltip label="Columns" openDelay={400}>
                <ActionIcon variant="default" size="lg" aria-label="Columns">
                  <IconColumns size={18} />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Columns</Menu.Label>
              {columns.options.map((o) => (
                <Menu.Item
                  key={o.value}
                  onClick={() => columns.onToggle(o.value)}
                  rightSection={!columns.hidden.includes(o.value) ? <IconCheck size={14} /> : undefined}
                >
                  {o.label}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        )}
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
      {count && (
        <Text size="xs" c="dimmed" mt={6}>
          {count.shown} {count.label}
        </Text>
      )}
    </Box>
  );
}
