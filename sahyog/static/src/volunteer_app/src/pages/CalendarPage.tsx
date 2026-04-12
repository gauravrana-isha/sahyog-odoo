import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Group,
  SegmentedControl,
  Skeleton,
  Text,
  Stack,
  ActionIcon,
  Button,
  Alert,
  Select,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
  IconChevronLeft,
  IconChevronRight,
  IconAlertCircle,
} from '@tabler/icons-react';
import { addMonths, addWeeks, format } from 'date-fns';
import { apiGet } from '../api';
import type { CalendarData } from '../types';
import {
  generateDateArray,
  getMonthDateRange,
  getWeekDateRange,
  formatPeriodLabel,
  ENTRY_COLORS,
} from '../utils/gantt';
import { GanttTimeline } from '../components/GanttTimeline';

export function CalendarPage() {
  const [zoomLevel, setZoomLevel] = useState<'month' | 'week'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Filter state
  const [entryTypeFilter, setEntryTypeFilter] = useState<string | null>('all');

  const dateRange = useMemo(() => {
    return zoomLevel === 'month'
      ? getMonthDateRange(currentDate)
      : getWeekDateRange(currentDate);
  }, [zoomLevel, currentDate]);

  const dateArray = useMemo(() => {
    return generateDateArray(dateRange.start, dateRange.end);
  }, [dateRange]);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const startStr = format(dateRange.start, 'yyyy-MM-dd');
    const endStr = format(dateRange.end, 'yyyy-MM-dd');
    apiGet<CalendarData>(`/calendar?date_start=${startStr}&date_end=${endStr}`)
      .then((result) => setData(result))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering
  const filteredData = useMemo(() => {
    if (!data) return null;

    let volunteers = data.volunteers;
    let entries = data.entries;

    // Filter entries by entry type
    if (entryTypeFilter && entryTypeFilter !== 'all') {
      entries = entries.filter((e) => e.entry_type === entryTypeFilter);
    }

    // Only show volunteers with visible entries
    const visibleVolIds = new Set(entries.map((e) => e.volunteer_id));
    volunteers = volunteers.filter((v) => visibleVolIds.has(v.id));

    return { volunteers, entries };
  }, [data, entryTypeFilter]);

  const goPrev = () => {
    setCurrentDate((d) =>
      zoomLevel === 'month' ? addMonths(d, -1) : addWeeks(d, -1),
    );
  };

  const goNext = () => {
    setCurrentDate((d) =>
      zoomLevel === 'month' ? addMonths(d, 1) : addWeeks(d, 1),
    );
  };

  const goToday = () => setCurrentDate(new Date());

  const periodLabel = formatPeriodLabel(zoomLevel, currentDate);

  return (
    <Stack gap="sm">
      {/* Row 1: Nav (left) | Period (center) | Type dropdown + Zoom (right) */}
      <Box style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        {/* Left: nav buttons */}
        <Group gap={4} style={{ flexShrink: 0 }}>
          <ActionIcon variant="default" size="md" onClick={goPrev} aria-label="Previous">
            <IconChevronLeft size={18} />
          </ActionIcon>
          <Button variant="default" size="xs" onClick={goToday}>Today</Button>
          <ActionIcon variant="default" size="md" onClick={goNext} aria-label="Next">
            <IconChevronRight size={18} />
          </ActionIcon>
        </Group>

        {/* Center: period label — takes remaining space */}
        <Text fw={600} size={isMobile ? 'sm' : 'md'} style={{ flex: 1, textAlign: 'center', minWidth: 100 }}>
          {periodLabel}
        </Text>

        {/* Right: type dropdown + zoom — on mobile, type goes to new line */}
        {!isMobile && (
          <Select
            data={[
              { value: 'all', label: 'All Types' },
              { value: 'silence', label: 'Silence' },
              { value: 'break', label: 'Break' },
              { value: 'program', label: 'Program' },
            ]}
            value={entryTypeFilter}
            onChange={setEntryTypeFilter}
            size="xs"
            comboboxProps={{ width: 140, position: 'bottom-start' }}
            style={{ width: 120, flexShrink: 0 }}
          />
        )}

        <SegmentedControl
          size="xs"
          value={zoomLevel}
          onChange={(v) => setZoomLevel(v as 'month' | 'week')}
          data={[
            { label: 'Month', value: 'month' },
            { label: 'Week', value: 'week' },
          ]}
          style={{ flexShrink: 0 }}
        />
      </Box>

      {/* Mobile only: type dropdown on its own line, full width */}
      {isMobile && (
        <Select
          data={[
            { value: 'all', label: 'All Types' },
            { value: 'silence', label: 'Silence' },
            { value: 'break', label: 'Break' },
            { value: 'program', label: 'Program' },
          ]}
          value={entryTypeFilter}
          onChange={setEntryTypeFilter}
          size="xs"
        />
      )}

      {/* Legend */}
      <Group gap="md">
        {Object.entries(ENTRY_COLORS).map(([type, color]) => (
          <Group key={type} gap={6}>
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: color,
              }}
            />
            <Text size="xs" tt="capitalize">
              {type}
            </Text>
          </Group>
        ))}
      </Group>

      {/* Content */}
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error}
        </Alert>
      )}

      {loading ? (
        <Stack gap="xs">
          <Skeleton height={36} />
          <Skeleton height={200} />
        </Stack>
      ) : filteredData ? (
        <GanttTimeline
          volunteers={filteredData.volunteers}
          entries={filteredData.entries}
          dateArray={dateArray}
          zoomLevel={zoomLevel}
          isMobile={isMobile ?? false}
        />
      ) : null}
    </Stack>
  );
}
