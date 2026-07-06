import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ActionIcon, Avatar, Badge, Box, Button, Collapse, Group, Menu,
  SegmentedControl, Select, SimpleGrid, Stack, Switch, Text, TextInput,
  UnstyledButton,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAward, IconBookmark, IconCheck, IconChevronDown, IconDownload,
  IconFlag, IconFlame, IconTrash, IconX,
} from '@tabler/icons-react';
import type { ColumnDef, RowSelectionState, SortingState } from '@tanstack/react-table';
import { apiGet, apiPost } from '../api';
import { usePR } from '../hooks/usePR';
import { STAGE_COLOR, TIER_COLOR } from '../tokens';
import { EmptyState } from '../components/EmptyState';
import { CardSkeleton } from '../components/CardSkeleton';
import { EntityCard } from '../components/EntityCard';
import { ListToolbar } from '../components/ListToolbar';
import { ListPager } from '../components/ListPager';
import { DataTable } from '../components/DataTable';
import { FilterPills, type FilterPill } from '../components/FilterPills';
import type { NominationLight, Paged } from '../types';

const STAGE_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Nominated', value: 'nominated' },
  { label: 'Researched', value: 'researched' },
  { label: 'Approved', value: 'approved' },
  { label: 'Nurturing', value: 'nurturing' },
  { label: 'Rejected', value: 'rejected' },
];

const TIER_FILTERS = [
  { value: '1', label: 'Tier 1 — Priority' },
  { value: '2', label: 'Tier 2 — Review' },
  { value: '3', label: 'Tier 3 — Low' },
];

const VERTICAL_FILTERS = [
  { value: 'business', label: 'Business & Corporate' },
  { value: 'asscm', label: 'Arts, Sports & Culture (ASSCM)' },
  { value: 'academia', label: 'Academia & Education' },
  { value: 'ngo_govt', label: 'Public Service (Govt & Civic)' },
  { value: 'medical', label: 'Medical & Healthcare' },
  { value: 'media', label: 'Media' },
  { value: 'emerging', label: 'Emerging & Next-Generation' },
  { value: 'environment', label: 'Environment & Sustainability' },
  { value: 'uncategorized', label: 'Uncategorized' },
  { value: 'review', label: 'Uncategorized (needs review)' },
];

// Values are server sort-field keys (also the table column ids).
const SORT_OPTIONS = [
  { value: 'tier', label: 'Tier (priority first)' },
  { value: 'newest', label: 'Newest first' },
  { value: 'name', label: 'Name (A–Z)' },
];

// Toggle semantics: pick one to group, pick another to nest under it.
const GROUP_OPTIONS = [
  { value: 'stage', label: 'Stage' },
  { value: 'vertical', label: 'Vertical' },
];

interface Group {
  key: string;
  title: string;
  items: NominationLight[];
  children?: Group[];
}

const STAGE_ORDER = ['nominated', 'researched', 'approved', 'nurturing', 'rejected'];
const STAGE_LABELS: Record<string, string> = {
  nominated: 'Nominated', researched: 'Researched', approved: 'Approved',
  nurturing: 'Nurturing', rejected: 'Rejected',
};

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

/** SortingState → server `order` param (field.asc/field.desc tokens). */
function sortingToOrder(sorting: SortingState): string {
  return sorting.map((s) => `${s.id}.${s.desc ? 'desc' : 'asc'}`).join(',') || 'tier';
}

function orderToSorting(order: string | null): SortingState {
  if (!order) return [{ id: 'tier', desc: false }];
  const parts = order.split(',')
    .map((t) => { const [id, dir] = t.split('.'); return { id, desc: dir === 'desc' }; })
    .filter((s) => s.id);
  return parts.length ? parts : [{ id: 'tier', desc: false }];
}

// Columns the eye-menu can hide (Nominee always stays).
const COLUMN_OPTIONS = [
  { value: 'organization', label: 'Role / Organization' },
  { value: 'tier', label: 'Tier' },
  { value: 'vertical', label: 'Vertical' },
  { value: 'stage', label: 'Stage' },
  { value: 'submitted', label: 'Submitted' },
];

interface SavedView { name: string; qs: string }

const VIEWS_KEY = 'pr_views:nominations';
const HIDDEN_COLS_KEY = 'pr_table_vis:nominations';

function loadJson<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || '') as T; }
  catch { return fallback; }
}

export function NominationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { me } = usePR();
  const isAdmin = !!me?.can.admin;
  const isWide = useMediaQuery('(min-width: 768px)');
  const [items, setItems] = useState<NominationLight[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(true);
  // Skeletons only on the very first load; refetches keep the current rows
  // in place so open popovers/menus survive filter changes.
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  // Initial state comes from the URL, so dashboard drill-downs and saved
  // views are just links.
  const [stage, setStage] = useState(searchParams.get('stage') || 'all');
  const [tier, setTier] = useState<string | null>(searchParams.get('tier'));
  const [vertical, setVertical] = useState<string | null>(searchParams.get('vertical'));
  const [priority, setPriority] = useState(searchParams.get('priority') === '1');
  const [needsReview, setNeedsReview] = useState(searchParams.get('flag') === 'review');
  const [month, setMonth] = useState<string | null>(searchParams.get('month'));
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [sorting, setSorting] = useState<SortingState>(orderToSorting(searchParams.get('order')));
  // Ordered comma list of group keys; '' = no grouping.
  const [groupBy, setGroupBy] = useState(searchParams.get('group') || '');
  const [view, setView] = useState(searchParams.get('v') || 'cards');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => loadJson<string[]>(HIDDEN_COLS_KEY, []));
  const [views, setViews] = useState<SavedView[]>(() => loadJson<SavedView[]>(VIEWS_KEY, []));
  const [viewName, setViewName] = useState('');

  const order = sortingToOrder(sorting);

  // Everything shareable about the current view, as a query string.
  const stateQs = useMemo(() => {
    const p = new URLSearchParams();
    if (stage !== 'all') p.set('stage', stage);
    if (tier) p.set('tier', tier);
    if (vertical) p.set('vertical', vertical);
    if (priority) p.set('priority', '1');
    if (needsReview) p.set('flag', 'review');
    if (month) p.set('month', month);
    if (q) p.set('q', q);
    if (order !== 'tier.asc') p.set('order', order);
    if (groupBy) p.set('group', groupBy);
    if (view !== 'cards') p.set('v', view);
    return p.toString();
  }, [stage, tier, vertical, priority, needsReview, month, q, order, groupBy, view]);

  // Keep the URL in sync so any view state is a shareable link.
  useEffect(() => {
    setSearchParams(new URLSearchParams(stateQs), { replace: true });
  }, [stateQs, setSearchParams]);

  const load = useCallback((stageF: string, tierF: string | null, verticalF: string | null, prio: boolean, review: boolean, monthF: string | null, search: string, orderP: string, off: number, lim: number) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (stageF !== 'all') params.set('stage', stageF);
    if (tierF) params.set('tier', tierF);
    if (verticalF) params.set('vertical', verticalF);
    if (prio) params.set('priority', '1');
    if (review) params.set('flag', 'review');
    if (monthF) params.set('month', monthF);
    if (search) params.set('q', search);
    params.set('order', orderP);
    params.set('offset', String(off));
    params.set('limit', String(lim));
    apiGet<Paged<NominationLight>>(`/nominations?${params.toString()}`)
      .then((r) => { setItems(r.records); setTotal(r.total); })
      .catch(() => { setItems([]); setTotal(0); })
      .finally(() => { setLoading(false); setHasLoaded(true); });
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(stage, tier, vertical, priority, needsReview, month, q, order, offset, limit), 250);
    return () => clearTimeout(t);
  }, [stage, tier, vertical, priority, needsReview, month, q, order, offset, limit, refresh, load]);

  // Any change of search/filter/sort restarts from the first page.
  const setStageReset = (v: string) => { setStage(v); setOffset(0); };
  const setTierReset = (v: string | null) => { setTier(v); setOffset(0); };
  const setVerticalReset = (v: string | null) => { setVertical(v); setOffset(0); };
  const setQReset = (v: string) => { setQ(v); setOffset(0); };
  const setPriorityReset = (v: boolean) => { setPriority(v); setOffset(0); };
  const setNeedsReviewReset = (v: boolean) => { setNeedsReview(v); setOffset(0); };
  const setMonthReset = (v: string | null) => { setMonth(v); setOffset(0); };
  const activeFilterCount = [tier, vertical, priority, needsReview, month].filter(Boolean).length;

  // Removable pills for every active popover filter.
  const pills: FilterPill[] = [
    tier ? { key: 'tier', label: `Tier ${tier}`, color: TIER_COLOR[tier] || 'sand', onClear: () => setTierReset(null) } : null,
    vertical ? { key: 'vertical', label: VERTICAL_FILTERS.find((v) => v.value === vertical)?.label || vertical, color: 'river', onClear: () => setVerticalReset(null) } : null,
    priority ? { key: 'priority', label: 'Priority leads', color: 'sage', onClear: () => setPriorityReset(false) } : null,
    needsReview ? { key: 'review', label: 'Needs review', color: 'red', onClear: () => setNeedsReviewReset(false) } : null,
    month ? { key: 'month', label: `Submitted ${month}`, color: 'ochre', onClear: () => setMonthReset(null) } : null,
  ].filter(Boolean) as FilterPill[];

  // ── Bulk actions over the selection ──
  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);
  const runBulk = async (action: string) => {
    setBulkBusy(action);
    try {
      const r = await apiPost<{ updated: number }>('/nominations/bulk-action', {
        ids: selectedIds, action,
      });
      notifications.show({ color: 'green', message: `${r.updated} nomination(s) updated` });
      setRowSelection({});
      setRefresh((n) => n + 1);
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally { setBulkBusy(null); }
  };

  // ── Column visibility (persisted) ──
  const toggleColumn = (id: string) => {
    setHiddenCols((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      try { localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  const columnVisibility = Object.fromEntries(hiddenCols.map((c) => [c, false]));

  // ── Saved views ──
  const persistViews = (next: SavedView[]) => {
    setViews(next);
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const saveView = () => {
    const name = viewName.trim();
    if (!name) return;
    persistViews([...views.filter((v) => v.name !== name), { name, qs: stateQs }]);
    setViewName('');
    notifications.show({ color: 'green', message: `View "${name}" saved` });
  };
  const applyView = (qs: string) => {
    const p = new URLSearchParams(qs);
    setStage(p.get('stage') || 'all');
    setTier(p.get('tier'));
    setVertical(p.get('vertical'));
    setPriority(p.get('priority') === '1');
    setNeedsReview(p.get('flag') === 'review');
    setMonth(p.get('month'));
    setQ(p.get('q') || '');
    setSorting(orderToSorting(p.get('order')));
    setGroupBy(p.get('group') || '');
    setView(p.get('v') || 'cards');
    setOffset(0);
  };
  const onSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    setSorting((old) => (typeof updater === 'function' ? updater(old) : updater));
    setOffset(0);
  };
  // The toolbar menu is a single-column shortcut over the same sorting state.
  const menuSort = sorting.length === 1 ? sorting[0].id : '';
  const setMenuSort = (v: string) => onSortingChange([{ id: v, desc: v === 'newest' }]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Toggle a group key: active → remove, inactive → append (nests under
  // whatever is already active, in selection order).
  const toggleGroupBy = (key: string) => {
    const list = groupBy ? groupBy.split(',') : [];
    const next = list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
    setGroupBy(next.join(','));
  };

  // Sorting is server-side (order param); grouping applies within the page.
  const groups = useMemo<Group[]>(() => {
    const byStage = (arr: NominationLight[], prefix: string): Group[] => STAGE_ORDER
      .map((s) => ({
        key: `${prefix}stage:${s}`,
        title: STAGE_LABELS[s],
        items: arr.filter((n) => n.stage === s),
      }))
      .filter((g) => g.items.length > 0);
    const byVertical = (arr: NominationLight[], prefix: string): Group[] => {
      const verticals = [...new Set(arr.map((n) => n.vertical_label || 'No vertical'))];
      return verticals.map((v) => ({
        key: `${prefix}vertical:${v}`,
        title: v,
        items: arr.filter((n) => (n.vertical_label || 'No vertical') === v),
      }));
    };
    const builders: Record<string, (arr: NominationLight[], prefix: string) => Group[]> = {
      stage: byStage,
      vertical: byVertical,
    };
    // Nest recursively in the order the group keys were selected.
    const build = (arr: NominationLight[], keys: string[], prefix: string): Group[] => {
      const [head, ...rest] = keys;
      const builder = builders[head];
      if (!builder) return [{ key: `${prefix}all`, title: '', items: arr }];
      const gs = builder(arr, prefix);
      return rest.length
        ? gs.map((g) => ({ ...g, children: build(g.items, rest, `${g.key}/`) }))
        : gs;
    };
    const keys = groupBy ? groupBy.split(',') : [];
    return keys.length ? build(items, keys, '') : [{ key: 'all', title: '', items }];
  }, [items, groupBy]);

  const filtersActive = stage !== 'all' || !!tier || !!vertical || !!q || priority || needsReview;

  const nominationCard = (n: NominationLight, idx: number) => (
    <EntityCard
      key={n.id}
      stagger={idx}
      onClick={() => navigate(`/nominations/${n.id}`)}
      leading={
        <Avatar radius="xl" color="clay" size={38} src={n.image_url}>
          {initials(n.nominee)}
        </Avatar>
      }
      title={n.nominee}
      titleExtras={n.high_priority && <IconFlame size={16} color="var(--mantine-color-clay-6)" />}
      badges={
        <>
          {n.tier && (
            <Badge size="xs" variant="light" color={TIER_COLOR[n.tier] || 'sand'}>Tier {n.tier}</Badge>
          )}
          <Badge size="xs" variant="light" color={STAGE_COLOR[n.stage] || 'sand'}>
            {n.stage_label || n.stage}
          </Badge>
        </>
      }
      meta={
        <>
          <Text size="xs" c="dimmed" mt={2} truncate>
            {[n.leadership_position, n.organization].filter(Boolean).join(' · ') || '—'}
          </Text>
          <Group gap={6} mt={4}>
            {n.vertical_label && (
              <Badge size="xs" variant="light" color="river">{n.vertical_label}</Badge>
            )}
            {n.is_self_nomination && (
              <Badge size="xs" variant="light" color="ochre">Self</Badge>
            )}
            {n.submission_date && (
              <Text size="xs" c="dimmed">{n.submission_date}</Text>
            )}
          </Group>
        </>
      }
    />
  );

  // Column ids double as server sort-field keys.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<NominationLight, any>[]>(() => [
    {
      id: 'name',
      header: 'Nominee',
      // accessorFn makes these real data columns — without it TanStack
      // treats them as display columns and header-click sort is disabled.
      accessorFn: (r) => r.nominee,
      size: 220,
      cell: ({ row }) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar radius="xl" color="clay" size={28} src={row.original.image_url}>
            {initials(row.original.nominee)}
          </Avatar>
          <Text fw={600} size="sm" truncate>{row.original.nominee}</Text>
          {row.original.high_priority && <IconFlame size={14} color="var(--mantine-color-clay-6)" />}
        </Group>
      ),
    },
    {
      id: 'organization',
      header: 'Role / Organization',
      accessorFn: (r) => r.organization,
      size: 240,
      cell: ({ row }) => (
        <Text size="sm" c="dimmed" truncate>
          {[row.original.leadership_position, row.original.organization].filter(Boolean).join(' · ') || '—'}
        </Text>
      ),
    },
    {
      id: 'tier',
      header: 'Tier',
      accessorFn: (r) => r.tier,
      size: 80,
      cell: ({ row }) => (
        row.original.tier
          ? <Badge size="xs" variant="light" color={TIER_COLOR[row.original.tier] || 'sand'}>T{row.original.tier}</Badge>
          : <Text size="sm" c="dimmed">—</Text>
      ),
    },
    {
      id: 'vertical',
      header: 'Vertical',
      accessorFn: (r) => r.vertical_label,
      size: 170,
      cell: ({ row }) => <Text size="sm" c="dimmed" truncate>{row.original.vertical_label || '—'}</Text>,
    },
    {
      id: 'stage',
      header: 'Stage',
      accessorFn: (r) => r.stage,
      size: 120,
      cell: ({ row }) => (
        <Badge size="xs" variant="light" color={STAGE_COLOR[row.original.stage] || 'sand'}>
          {row.original.stage_label || row.original.stage}
        </Badge>
      ),
    },
    {
      id: 'submitted',
      header: 'Submitted',
      accessorFn: (r) => r.submission_date,
      size: 110,
      cell: ({ row }) => <Text size="sm" c="dimmed">{row.original.submission_date || '—'}</Text>,
    },
  ], []);

  const showTable = isWide && view === 'table';

  // Per-column filter popovers on the table headers, driving the same
  // server-side filter state as the toolbar panel.
  const columnFilters = {
    tier: {
      active: !!tier,
      content: (
        <Select label="Tier" placeholder="All tiers" size="xs" data={TIER_FILTERS}
          value={tier} onChange={setTierReset} clearable comboboxProps={{ withinPortal: false }} />
      ),
    },
    vertical: {
      active: !!vertical,
      content: (
        <Select label="Vertical" placeholder="All verticals" size="xs" data={VERTICAL_FILTERS}
          value={vertical} onChange={setVerticalReset} clearable searchable
          comboboxProps={{ withinPortal: false }} />
      ),
    },
    stage: {
      active: stage !== 'all',
      content: (
        <Select label="Stage" placeholder="All stages" size="xs"
          data={STAGE_FILTERS.filter((s) => s.value !== 'all')}
          value={stage === 'all' ? null : stage}
          onChange={(v) => setStageReset(v || 'all')}
          clearable comboboxProps={{ withinPortal: false }} />
      ),
    },
  };

  const leafContent = (rows: NominationLight[]) => (
    showTable ? (
      <DataTable
        data={rows}
        columns={columns}
        sorting={sorting}
        onSortingChange={onSortingChange}
        onRowClick={(n) => navigate(`/nominations/${n.id}`)}
        storageKey="pr_table_widths:nominations"
        minWidth={880}
        columnFilters={columnFilters}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        getRowId={(n) => String(n.id)}
        columnVisibility={columnVisibility}
      />
    ) : (
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {rows.map(nominationCard)}
      </SimpleGrid>
    )
  );

  const renderGroup = (g: Group, depth: number): JSX.Element => {
    const isCollapsed = collapsedGroups.has(g.key);
    const stageKey = g.key.split(':').pop() || '';
    return (
      <Box key={g.key} pl={depth > 0 ? 'lg' : 0}>
        {g.title && (
          <UnstyledButton onClick={() => toggleGroup(g.key)} mb="sm" aria-expanded={!isCollapsed}>
            <Group gap="xs">
              <IconChevronDown
                size={depth > 0 ? 15 : 18}
                color="var(--mantine-color-dimmed)"
                style={{
                  transform: isCollapsed ? 'rotate(-90deg)' : 'none',
                  transition: 'transform 150ms ease',
                }}
              />
              <Text ff="heading" fw={600} fz={depth > 0 ? 'md' : 'lg'}>{g.title}</Text>
              <Badge size="sm" variant="light" color={STAGE_COLOR[stageKey] || 'river'}>{g.items.length}</Badge>
            </Group>
          </UnstyledButton>
        )}
        <Collapse in={!g.title || !isCollapsed}>
          {g.children ? (
            <Stack gap="md">{g.children.map((c) => renderGroup(c, depth + 1))}</Stack>
          ) : (
            leafContent(g.items)
          )}
        </Collapse>
      </Box>
    );
  };

  return (
    <Box style={{ maxWidth: isWide ? 1100 : undefined, margin: isWide ? '0 auto' : undefined }}>
      {/* Six segments overflow small screens — swipe horizontally on mobile */}
      <Box mb="sm" className="sahyog-no-scrollbar" style={{ overflowX: 'auto' }}>
        <SegmentedControl
          fullWidth={isWide}
          size="xs"
          value={stage}
          onChange={setStageReset}
          data={STAGE_FILTERS}
          style={{ minWidth: isWide ? undefined : 'max-content' }}
        />
      </Box>
      <ListToolbar
        search={q}
        onSearch={setQReset}
        searchPlaceholder="Search nominee or organization…"
        filters={
          <>
            <Select label="Tier" placeholder="All tiers" size="xs" data={TIER_FILTERS}
              value={tier} onChange={setTierReset} clearable />
            <Select label="Vertical" placeholder="All verticals" size="xs" data={VERTICAL_FILTERS}
              value={vertical} onChange={setVerticalReset} clearable searchable />
            <Switch label="Priority leads only" size="xs" checked={priority}
              onChange={(e) => setPriorityReset(e.currentTarget.checked)} />
            <Switch label="Needs review" size="xs" checked={needsReview}
              onChange={(e) => setNeedsReviewReset(e.currentTarget.checked)} />
          </>
        }
        activeFilterCount={activeFilterCount}
        sort={{ value: menuSort, onChange: setMenuSort, options: SORT_OPTIONS }}
        groupBy={{ value: groupBy, onChange: toggleGroupBy, options: GROUP_OPTIONS, multi: true }}
        view={{ value: view, onChange: setView }}
        columns={{ options: COLUMN_OPTIONS, hidden: hiddenCols, onToggle: toggleColumn }}
        count={loading ? undefined : { shown: total, label: total === 1 ? 'nomination' : 'nominations' }}
        trailing={
          <Menu shadow="md" position="bottom-end" withinPortal closeOnItemClick={false}>
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label="Saved views and export">
                <IconBookmark size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Saved views</Menu.Label>
              {views.length === 0 && <Menu.Item disabled>No saved views yet</Menu.Item>}
              {views.map((v) => (
                <Menu.Item
                  key={v.name}
                  onClick={() => applyView(v.qs)}
                  rightSection={
                    <IconTrash
                      size={14}
                      style={{ cursor: 'pointer' }}
                      aria-label={`Delete view ${v.name}`}
                      onClick={(e) => { e.stopPropagation(); persistViews(views.filter((x) => x.name !== v.name)); }}
                    />
                  }
                >
                  {v.name}
                </Menu.Item>
              ))}
              <Box p="xs">
                <TextInput
                  size="xs"
                  placeholder="View name…"
                  value={viewName}
                  onChange={(e) => setViewName(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveView()}
                />
                <Button size="xs" fullWidth mt={6} variant="light" onClick={saveView} disabled={!viewName.trim()}>
                  Save current view
                </Button>
              </Box>
              <Menu.Divider />
              <Menu.Item
                component="a"
                href={`/pr/api/nominations/export?${stateQs}`}
                leftSection={<IconDownload size={16} />}
                closeMenuOnClick
              >
                Export CSV (filtered)
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        }
      />

      <FilterPills pills={pills} />

      {/* Bulk action bar — appears when table rows are selected */}
      {selectedIds.length > 0 && (
        <Group gap="xs" mb="md" p="xs" style={{
          borderRadius: 'var(--mantine-radius-md)',
          backgroundColor: 'var(--mantine-color-clay-light)',
        }}>
          <Text size="sm" fw={600}>{selectedIds.length} selected</Text>
          <Button size="compact-xs" variant="light" leftSection={<IconFlag size={13} />}
            loading={bulkBusy === 'mark_researched'} onClick={() => runBulk('mark_researched')}>
            Mark Researched
          </Button>
          {isAdmin && (
            <>
              <Button size="compact-xs" variant="light" color="sage" leftSection={<IconCheck size={13} />}
                loading={bulkBusy === 'approve'} onClick={() => runBulk('approve')}>
                Approve
              </Button>
              <Button size="compact-xs" variant="light" color="red" leftSection={<IconX size={13} />}
                loading={bulkBusy === 'reject'} onClick={() => runBulk('reject')}>
                Reject
              </Button>
            </>
          )}
          <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setRowSelection({})}>
            Clear
          </Button>
        </Group>
      )}

      {loading && !hasLoaded ? (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} leading="avatar" />)}
        </SimpleGrid>
      ) : total === 0 && !loading ? (
        <EmptyState
          icon={IconAward}
          title={filtersActive ? 'No nominations found' : 'No nominations yet'}
          description={filtersActive
            ? 'Nothing matches these filters. Try widening the stage or tier.'
            : 'Nominations submitted through the public form will appear here for review.'}
        />
      ) : (
        <Stack gap="lg" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 100ms ease' }}>
          {groups.map((g) => renderGroup(g, 0))}
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
    </Box>
  );
}
