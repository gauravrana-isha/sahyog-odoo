import { useEffect, useState, type ReactNode } from 'react';
import { ActionIcon, Card, Checkbox, Group, Popover, Table, Text } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconFilter } from '@tabler/icons-react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';

interface DataTableProps<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  /** Controlled sorting state — server-side ordering (manualSorting). */
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  onRowClick?: (row: T) => void;
  /** localStorage key for persisting user column widths. */
  storageKey?: string;
  /** Minimum table width before horizontal scrolling kicks in. */
  minWidth?: number;
  /** Per-column filter popovers, keyed by column id. `active` tints the
   *  funnel so a filtered column is visible at a glance. */
  columnFilters?: Record<string, { content: ReactNode; active?: boolean }>;
  /** Controlled row selection (adds a sticky checkbox column). */
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /** Row id extractor — required for stable selection across pages. */
  getRowId?: (row: T) => string;
  /** Controlled column visibility (drive it from a toolbar eye-menu). */
  columnVisibility?: VisibilityState;
}

function loadSizing(key?: string): ColumnSizingState {
  if (!key) return {};
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

/** Enterprise table for list pages: horizontal scroll, drag-resizable
 *  columns (persisted per table), click-to-sort headers and shift-click
 *  multi-column sort. Sorting is manual — the caller translates the state
 *  into the server `order` param. */
export function DataTable<T>({
  data, columns, sorting, onSortingChange, onRowClick, storageKey, minWidth = 760,
  columnFilters, rowSelection, onRowSelectionChange, getRowId, columnVisibility,
}: DataTableProps<T>) {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => loadSizing(storageKey));

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(columnSizing));
    } catch { /* storage full/blocked — widths just won't persist */ }
  }, [columnSizing, storageKey]);

  const selectable = !!onRowSelectionChange;
  const allColumns = selectable
    ? [{
        id: '__select',
        size: 44,
        enableSorting: false,
        enableResizing: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        header: ({ table: t }: any) => (
          <Checkbox
            size="xs"
            radius={4}
            aria-label="Select all"
            checked={t.getIsAllRowsSelected()}
            indeterminate={t.getIsSomeRowsSelected()}
            onChange={t.getToggleAllRowsSelectedHandler()}
          />
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cell: ({ row }: any) => (
          <Checkbox
            size="xs"
            radius={4}
            aria-label="Select row"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      } as ColumnDef<T, unknown>, ...columns]
    : columns;

  const table = useReactTable({
    data,
    columns: allColumns,
    state: {
      sorting,
      columnSizing,
      ...(rowSelection ? { rowSelection } : {}),
      ...(columnVisibility ? { columnVisibility } : {}),
    },
    onSortingChange,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange,
    getRowId,
    enableRowSelection: selectable,
    manualSorting: true,
    enableMultiSort: true,
    isMultiSortEvent: (e) => (e as MouseEvent).shiftKey,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Card withBorder padding={0} className="sahyog-fade-up">
      <Table.ScrollContainer minWidth={minWidth}>
        <Table
          highlightOnHover
          verticalSpacing="sm"
          horizontalSpacing="md"
          style={{ width: table.getCenterTotalSize(), minWidth: '100%', tableLayout: 'fixed' }}
        >
          <Table.Thead>
            {table.getHeaderGroups().map((hg) => (
              <Table.Tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const sortIndex = header.column.getSortIndex();
                  return (
                    <Table.Th
                      key={header.id}
                      style={{
                        width: header.getSize(),
                        position: 'relative',
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        cursor: header.column.getCanSort() ? 'pointer' : undefined,
                      }}
                      onClick={header.column.getToggleSortingHandler()}
                      title={header.column.getCanSort() ? 'Click to sort · Shift-click to add to sort' : undefined}
                    >
                      <Group gap={4} wrap="nowrap">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' && <IconArrowUp size={13} style={{ flexShrink: 0 }} />}
                        {sorted === 'desc' && <IconArrowDown size={13} style={{ flexShrink: 0 }} />}
                        {sorted && sorting.length > 1 && (
                          <Text size="10px" c="dimmed" fw={700} style={{ flexShrink: 0 }}>{sortIndex + 1}</Text>
                        )}
                        {columnFilters?.[header.column.id] && (
                          <span
                            className="dt-col-filter"
                            data-active={columnFilters[header.column.id].active ? 'true' : undefined}
                            // Stop here so opening the filter never reaches the
                            // th's sort handler (Popover.Target swallows the
                            // icon's own stopPropagation).
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Popover shadow="md" position="bottom-start" width={240} withinPortal>
                              <Popover.Target>
                                <ActionIcon
                                  variant={columnFilters[header.column.id].active ? 'light' : 'subtle'}
                                  color={columnFilters[header.column.id].active ? 'clay' : 'gray'}
                                  size="xs"
                                  aria-label={`Filter ${header.column.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <IconFilter size={12} />
                                </ActionIcon>
                              </Popover.Target>
                              <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
                                {columnFilters[header.column.id].content}
                              </Popover.Dropdown>
                            </Popover>
                          </span>
                        )}
                      </Group>
                      {header.column.getCanResize() && (
                        <div
                          className="pr-col-resizer"
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onClick={(e) => e.stopPropagation()}
                          role="separator"
                          aria-orientation="vertical"
                        />
                      )}
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Thead>
          <Table.Tbody>
            {table.getRowModel().rows.map((row) => (
              <Table.Tr
                key={row.id}
                style={{ cursor: onRowClick ? 'pointer' : undefined }}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <Table.Td key={cell.id} style={{ width: cell.column.getSize(), overflow: 'hidden' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}
