import { useRef, useEffect } from 'react';
import { Box, Text } from '@mantine/core';
import { isSameDay } from 'date-fns';
import type { CalendarEntry } from '../types';
import { computeGridRows, formatDateLabel, isWeekend } from '../utils/gantt';
import { GanttBar } from './GanttBar';

interface GanttTimelineProps {
  volunteers: { id: number; name: string; volunteer_type_ids?: number[] }[];
  entries: CalendarEntry[];
  dateArray: Date[];
  zoomLevel: 'month' | 'week';
  isMobile?: boolean;
}

export function GanttTimeline({ volunteers, entries, dateArray, zoomLevel, isMobile = false }: GanttTimelineProps) {
  const NAME_W = isMobile ? 100 : 160;
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = computeGridRows(volunteers, entries, dateArray);
  const today = new Date();
  const totalDays = dateArray.length;
  const todayIndex = dateArray.findIndex((d) => isSameDay(d, today));

  // Auto-scroll to today's column on mount and when dateArray changes
  useEffect(() => {
    if (todayIndex < 0 || !scrollRef.current) return;
    const container = scrollRef.current;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    // Position today roughly in the center of the visible area
    const todayPos = (todayIndex / totalDays) * scrollWidth;
    const scrollTo = Math.max(0, todayPos - clientWidth / 2);
    container.scrollLeft = scrollTo;
  }, [todayIndex, totalDays, dateArray]);

  // Use compact labels on mobile week view
  const compactLabels = isMobile && zoomLevel === 'week';

  // Helper to compute row height
  const getRowHeight = (bars: { laneIndex: number }[]) => {
    const maxLane = bars.reduce((m, b) => Math.max(m, b.laneIndex), -1);
    return Math.max(maxLane + 1, 1) * 26 + 12;
  };

  return (
    <Box style={{ border: '1px solid #dee2e6', borderRadius: 4, overflow: 'hidden' }}>
      {/* Outer wrapper: name col (fixed) + scrollable area */}
      <Box style={{ display: 'flex' }}>
        {/* Fixed name column */}
        <Box style={{ width: NAME_W, flexShrink: 0, borderRight: '2px solid #dee2e6', backgroundColor: '#fff', zIndex: 2 }}>
          {/* Name header */}
          <Box style={{ height: 36, display: 'flex', alignItems: 'center', paddingLeft: 8, backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
            <Text size="xs" fw={600}>Volunteer</Text>
          </Box>
          {/* Name rows */}
          {rows.map((row) => (
            <Box
              key={row.volunteer.id}
              style={{
                height: getRowHeight(row.bars),
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
                paddingRight: 4,
                borderBottom: '1px solid #eee',
                overflow: 'hidden',
              }}
            >
              <Text size="xs" lineClamp={1} title={row.volunteer.name}>{row.volunteer.name}</Text>
            </Box>
          ))}
        </Box>

        {/* Scrollable days + bars area */}
        <Box ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          {/* Use a table-like layout: each day is equal width */}
          <Box style={{ display: 'flex', flexDirection: 'column', minWidth: isMobile ? totalDays * 28 : undefined }}>
            {/* Day headers row */}
            <Box style={{ display: 'flex', height: 36, borderBottom: '1px solid #dee2e6', flexShrink: 0 }}>
              {dateArray.map((date, i) => {
                const wknd = isWeekend(date);
                const isT = isSameDay(date, today);
                return (
                  <Box
                    key={i}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isT ? '#e7f5ff' : wknd ? '#f1f3f5' : '#f8f9fa',
                      borderRight: '1px solid #eee',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    <Text size={isMobile ? '10px' : 'xs'} c={wknd ? 'dimmed' : undefined} fw={isT ? 700 : 400}>
                      {formatDateLabel(date, zoomLevel, compactLabels)}
                    </Text>
                  </Box>
                );
              })}
            </Box>

            {/* Volunteer rows with bars */}
            {rows.map((row) => {
              const rowH = getRowHeight(row.bars);
              return (
                <Box key={row.volunteer.id} style={{ position: 'relative', height: rowH }}>
                  {/* Cell backgrounds */}
                  <Box style={{ display: 'flex', height: '100%', position: 'absolute', inset: 0 }}>
                    {dateArray.map((date, i) => {
                      const wknd = isWeekend(date);
                      const isT = isSameDay(date, today);
                      return (
                        <Box
                          key={i}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            borderRight: '1px solid #f0f0f0',
                            borderBottom: '1px solid #eee',
                            backgroundColor: isT ? '#f0f8ff' : wknd ? '#fafafa' : undefined,
                          }}
                        />
                      );
                    })}
                  </Box>

                  {/* Bars — positioned using percentage of the row width */}
                  {row.bars.map((bar) => (
                    <GanttBar key={bar.entry.id} bar={bar} totalDays={totalDays} />
                  ))}

                  {/* Today line */}
                  {todayIndex >= 0 && (
                    <Box
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${((todayIndex + 0.5) / totalDays) * 100}%`,
                        width: 2,
                        backgroundColor: '#e74c3c',
                        zIndex: 3,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
