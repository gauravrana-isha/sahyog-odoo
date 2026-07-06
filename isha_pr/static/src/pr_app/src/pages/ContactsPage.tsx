import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionIcon, TextInput, Stack, Text, Group, Badge, Button, Collapse, Modal,
  Select, SimpleGrid, Avatar, Box, Tooltip, UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus, IconAddressBook, IconChevronDown, IconDownload, IconMapPin,
} from '@tabler/icons-react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { apiGet, apiPost } from '../api';
import { usePR } from '../hooks/usePR';
import { VIP_COLOR, INVOLVEMENT_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/CardSkeleton';
import { EntityCard } from '../components/EntityCard';
import { ListToolbar } from '../components/ListToolbar';
import { ListPager } from '../components/ListPager';
import { DataTable } from '../components/DataTable';
import { FilterPills, type FilterPill } from '../components/FilterPills';
import type { Contact, Paged } from '../types';

// Columns the eye-menu can hide (Name always stays).
const COLUMN_OPTIONS = [
  { value: 'contact', label: 'Contact' },
  { value: 'involvement', label: 'Involvement' },
  { value: 'interactions', label: 'Interactions' },
];

const HIDDEN_COLS_KEY = 'pr_table_vis:contacts';

function loadJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; }
  catch { return fallback; }
}

// Server-side sort keys (whitelisted in the contacts endpoint).
const SORT_OPTIONS = [
  { value: 'name', label: 'Name (A–Z)' },
  { value: 'newest', label: 'Newest first' },
  { value: 'vip', label: 'VIP first' },
];

const GROUP_OPTIONS = [
  { value: 'involvement', label: 'Involvement level' },
];

const INVOLVEMENT_ORDER = ['high', 'moderate', 'low', ''];
const INVOLVEMENT_LABELS: Record<string, string> = {
  high: 'High involvement',
  moderate: 'Moderate involvement',
  low: 'Low involvement',
  '': 'No involvement set',
};

const INVOLVEMENT_FILTERS = [
  { value: 'high', label: 'High' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'low', label: 'Low' },
];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/** SortingState → server `order` param (field.asc/field.desc tokens). */
function sortingToOrder(sorting: SortingState): string {
  return sorting.map((s) => `${s.id}.${s.desc ? 'desc' : 'asc'}`).join(',') || 'name';
}

export function ContactsPage() {
  const [q, setQ] = useState('');
  const [regionId, setRegionId] = useState<string | null>(null);
  const [involvement, setInvolvement] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  // Skeletons only on the very first load; refetches keep rows in place.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [groupBy, setGroupBy] = useState('');
  const [view, setView] = useState('cards');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { me } = usePR();
  const isWide = useMediaQuery('(min-width: 768px)');

  const load = useCallback((search: string, region: string | null, involvementF: string | null, order: string, off: number, lim: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (region) params.set('region_id', region);
    if (involvementF) params.set('involvement', involvementF);
    params.set('order', order);
    params.set('offset', String(off));
    params.set('limit', String(lim));
    apiGet<Paged<Contact>>(`/contacts?${params.toString()}`)
      .then((r) => { setContacts(r.records); setTotal(r.total); })
      .catch(() => { setContacts([]); setTotal(0); })
      .finally(() => { setLoading(false); setHasLoaded(true); });
  }, []);

  const order = sortingToOrder(sorting);

  useEffect(() => {
    const t = setTimeout(() => load(q, regionId, involvement, order, offset, limit), 250);
    return () => clearTimeout(t);
  }, [q, regionId, involvement, order, offset, limit, load]);

  // Any change of search/filter/sort restarts from the first page.
  const setQReset = (v: string) => { setQ(v); setOffset(0); };
  const setRegionReset = (v: string | null) => { setRegionId(v); setOffset(0); };
  const setInvolvementReset = (v: string | null) => { setInvolvement(v); setOffset(0); };
  const activeFilterCount = [regionId, involvement].filter(Boolean).length;

  const pills: FilterPill[] = [
    regionId ? {
      key: 'region',
      label: me?.regions.find((r) => String(r.id) === regionId)?.name || 'Region',
      color: 'river',
      onClear: () => setRegionReset(null),
    } : null,
    involvement ? {
      key: 'involvement',
      label: `${involvement[0].toUpperCase()}${involvement.slice(1)} involvement`,
      color: 'ochre',
      onClear: () => setInvolvementReset(null),
    } : null,
  ].filter(Boolean) as FilterPill[];

  const [hiddenCols, setHiddenCols] = useState<string[]>(() => loadJson<string[]>(HIDDEN_COLS_KEY, []));
  const toggleColumn = (id: string) => {
    setHiddenCols((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      try { localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const columnVisibility = Object.fromEntries(hiddenCols.map((c) => [c, false]));

  const exportQs = (() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (regionId) p.set('region_id', regionId);
    if (involvement) p.set('involvement', involvement);
    p.set('order', order);
    return p.toString();
  })();
  const onSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    setSorting((old) => (typeof updater === 'function' ? updater(old) : updater));
    setOffset(0);
  };
  // The toolbar menu is a single-column shortcut over the same sorting state.
  const menuSort = sorting.length === 1 ? sorting[0].id : '';
  const setMenuSort = (v: string) => onSortingChange([{ id: v, desc: v === 'newest' || v === 'vip' }]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const c = await apiPost<Contact>('/contacts/create', form);
      close();
      setForm({ name: '', email: '', phone: '' });
      navigate(`/contacts/${c.id}`);
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  // Sorting is server-side (order param); grouping applies within the page.
  const groups = useMemo(() => {
    if (groupBy !== 'involvement') return [{ key: 'all', title: '', items: contacts }];
    return INVOLVEMENT_ORDER
      .map((level) => ({
        key: level || 'none',
        title: INVOLVEMENT_LABELS[level],
        items: contacts.filter((c) => (c.pr_involvement || '') === level),
      }))
      .filter((g) => g.items.length > 0);
  }, [contacts, groupBy]);

  const contactCard = (c: Contact, idx: number) => (
    <EntityCard
      key={c.id}
      stagger={idx}
      onClick={() => navigate(`/contacts/${c.id}`)}
      leading={
        <Avatar src={c.image_url} radius="xl" color="clay" size={38}>
          {initials(c.name)}
        </Avatar>
      }
      title={c.name}
      titleExtras={c.vip && <Badge size="xs" variant="light" color={VIP_COLOR}>VIP</Badge>}
      badges={
        <>
          {c.pr_involvement &&
            <Badge size="xs" variant="light" color={INVOLVEMENT_COLOR}>{c.pr_involvement}</Badge>}
          {c.interaction_count > 0 &&
            <Badge size="xs" variant="light">{c.interaction_count}</Badge>}
        </>
      }
      meta={<Text size="xs" c="dimmed" mt={2} truncate>{c.email || c.phone || '—'}</Text>}
    />
  );

  // Column ids double as server sort-field keys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<Contact, any>[]>(() => [
    {
      id: 'name',
      header: 'Name',
      // accessorFn makes it a sortable data column (display columns can't sort)
      accessorFn: (r) => r.name,
      size: 240,
      cell: ({ row }) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={row.original.image_url} radius="xl" color="clay" size={28}>
            {initials(row.original.name)}
          </Avatar>
          <Text fw={600} size="sm" truncate>{row.original.name}</Text>
          {row.original.vip && <Badge size="xs" variant="light" color={VIP_COLOR}>VIP</Badge>}
        </Group>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      size: 240,
      enableSorting: false,
      cell: ({ row }) => (
        <Text size="sm" c="dimmed" truncate>{row.original.email || row.original.phone || '—'}</Text>
      ),
    },
    {
      id: 'involvement',
      header: 'Involvement',
      accessorFn: (r) => r.pr_involvement,
      size: 130,
      cell: ({ row }) => (
        row.original.pr_involvement
          ? <Badge size="xs" variant="light" color={INVOLVEMENT_COLOR}>{row.original.pr_involvement}</Badge>
          : <Text size="sm" c="dimmed">—</Text>
      ),
    },
    {
      id: 'interactions',
      header: 'Interactions',
      size: 110,
      // Computed non-stored field — the server cannot order by it.
      enableSorting: false,
      cell: ({ row }) => <Text size="sm">{row.original.interaction_count || '—'}</Text>,
    },
  ], []);

  const showTable = isWide && view === 'table';

  return (
    <Box style={{ maxWidth: isWide ? 1100 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <ListToolbar
        search={q}
        onSearch={setQReset}
        searchPlaceholder="Search contacts…"
        filters={
          <>
            <Select
              label="Region"
              size="xs"
              leftSection={<IconMapPin size={14} />}
              placeholder="All regions"
              data={(me?.regions ?? []).map((r) => ({ value: String(r.id), label: r.name }))}
              value={regionId}
              onChange={setRegionReset}
              clearable
              searchable
            />
            <Select
              label="Involvement"
              size="xs"
              placeholder="All levels"
              data={INVOLVEMENT_FILTERS}
              value={involvement}
              onChange={setInvolvementReset}
              clearable
            />
          </>
        }
        activeFilterCount={activeFilterCount}
        sort={{ value: menuSort, onChange: setMenuSort, options: SORT_OPTIONS }}
        groupBy={{
          value: groupBy,
          onChange: (v) => setGroupBy(groupBy === v ? '' : v),
          options: GROUP_OPTIONS,
          multi: true,
        }}
        view={{ value: view, onChange: setView }}
        columns={{ options: COLUMN_OPTIONS, hidden: hiddenCols, onToggle: toggleColumn }}
        count={loading ? undefined : { shown: total, label: total === 1 ? 'contact' : 'contacts' }}
        trailing={
          <>
            <Tooltip label="Export CSV (filtered)" openDelay={400}>
              <ActionIcon
                component="a"
                href={`/pr/api/contacts/export?${exportQs}`}
                variant="default"
                size="lg"
                aria-label="Export CSV"
              >
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
            <Button leftSection={<IconPlus size={16} />} onClick={open}>
              New
            </Button>
          </>
        }
      />

      <FilterPills pills={pills} />

      {loading && !hasLoaded ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} leading="avatar" />)}
        </SimpleGrid>
      ) : total === 0 && !loading ? (
        <EmptyState
          icon={IconAddressBook}
          title={q || regionId ? 'No contacts found' : 'No contacts yet'}
          description={q || regionId ? 'No contacts match your search or region filter.' : 'Tap "New" to add your first PR contact.'}
        />
      ) : (
        <Stack gap="lg">
          {groups.map((g) => {
            const isCollapsed = collapsedGroups.has(g.key);
            return (
              <Box key={g.key}>
                {g.title && (
                  <UnstyledButton onClick={() => toggleGroup(g.key)} mb="sm" aria-expanded={!isCollapsed}>
                    <Group gap="xs">
                      <IconChevronDown
                        size={18}
                        color="var(--mantine-color-dimmed)"
                        style={{
                          transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                          transition: 'transform 150ms ease',
                        }}
                      />
                      <Text ff="heading" fw={600} fz="lg">{g.title}</Text>
                      <Badge size="sm" variant="light" color="river">{g.items.length}</Badge>
                    </Group>
                  </UnstyledButton>
                )}
                <Collapse in={!g.title || !isCollapsed}>
                  {showTable ? (
                    <DataTable
                      data={g.items}
                      columns={columns}
                      sorting={sorting}
                      onSortingChange={onSortingChange}
                      onRowClick={(c) => navigate(`/contacts/${c.id}`)}
                      storageKey="pr_table_widths:contacts"
                      minWidth={720}
                      columnVisibility={columnVisibility}
                      columnFilters={{
                        involvement: {
                          active: !!involvement,
                          content: (
                            <Select label="Involvement" placeholder="All levels" size="xs"
                              data={INVOLVEMENT_FILTERS} value={involvement}
                              onChange={setInvolvementReset} clearable
                              comboboxProps={{ withinPortal: false }} />
                          ),
                        },
                      }}
                    />
                  ) : (
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                      {g.items.map(contactCard)}
                    </SimpleGrid>
                  )}
                </Collapse>
              </Box>
            );
          })}
        </Stack>
      )}

      {total > 0 && (
        <ListPager
          total={total}
          offset={offset}
          limit={limit}
          onChange={(o, l) => { setOffset(o); setLimit(l); }}
        />
      )}

      <Modal opened={opened} onClose={close} title="New PR contact">
        <Stack>
          <TextInput label="Name" required value={form.name}
            onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} />
          <TextInput label="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.currentTarget.value })} />
          <TextInput label="Phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} />
          <Button loading={saving} onClick={create}>Create</Button>
        </Stack>
      </Modal>
    </Box>
  );
}
