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

  useEffect(() => {
    if (todayIndex < 0 || !scrollRef.current) return;
    const container = scrollRef.current;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    const todayPos = (todayIndex / totalDays) * scrollWidth;
    const scrollTo = Math.max(0, todayPos - clientWidth / 2);
    container.scrollLeft = scrollTo;
  }, [todayIndex, totalDays, dateArray]);

  const compactLabels = isMobile && zoomLevel === 'week';

  const getRowHeight = (bars: { laneIndex: number }[]) => {
    const maxLane = bars.reduce((m, b) => Math.max(m, b.laneIndex), -1);
    return Math.max(maxLane + 1, 1) * 26 + 12;
  };

  return (
    <Box style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 4, overflow: 'hidden' }}>
      <Box style={{ display: 'flex' }}>
        {/* Fixed name column */}
        <Box style={{ width: NAME_W, flexShrink: 0, borderRight: '2px solid var(--mantine-color-default-border)', backgroundColor: 'var(--mantine-color-body)', zIndex: 2 }}>
          <Box style={{ height: 36, display: 'flex', alignItems: 'center', paddingLeft: 8, backgroundColor: 'var(--mantine-color-gray-light)', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" fw={600}>Volunteer</Text>
          </Box>
          {rows.map((row) => (
            <Box
              key={row.volunteer.id}
              style={{
                height: getRowHeight(row.bars),
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 8,
                paddingRight: 4,
                borderBottom: '1px solid var(--mantine-color-default-border)',
                overflow: 'hidden',
              }}
            >
              <Text size="xs" lineClamp={1} title={row.volunteer.name}>{row.volunteer.name}</Text>
            </Box>
          ))}
        </Box>

        {/* Scrollable days + bars */}
        <Box ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          <Box style={{ display: 'flex', flexDirection: 'column', minWidth: isMobile ? totalDays * 28 : undefined }}>
            {/* Day headers */}
            <Box style={{ display: 'flex', height: 36, borderBottom: '1px solid var(--mantine-color-default-border)', flexShrink: 0 }}>
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
                      backgroundColor: isT ? 'var(--mantine-color-blue-light)' : wknd ? 'var(--mantine-color-gray-light)' : 'var(--mantine-color-gray-light)',
                      borderRight: '1px solid var(--mantine-color-default-border)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      opacity: wknd && !isT ? 0.7 : 1,
                    }}
                  >
                    <Text size={isMobile ? '10px' : 'xs'} c={wknd ? 'dimmed' : undefined} fw={isT ? 700 : 400}>
                      {formatDateLabel(date, zoomLevel, compactLabels)}
                    </Text>
                  </Box>
                );
              })}
            </Box>

            {/* Rows */}
            {rows.map((row) => {
              const rowH = getRowHeight(row.bars);
              return (
                <Box key={row.volunteer.id} style={{ position: 'relative', height: rowH }}>
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
                            borderRight: '1px solid var(--mantine-color-default-border)',
                            borderBottom: '1px solid var(--mantine-color-default-border)',
                            backgroundColor: isT ? 'var(--mantine-color-blue-light)' : wknd ? 'var(--mantine-color-gray-light)' : undefined,
                            opacity: wknd && !isT ? 0.5 : 1,
                          }}
                        />
                      );
                    })}
                  </Box>

                  {row.bars.map((bar) => (
                    <GanttBar key={bar.entry.id} bar={bar} totalDays={totalDays} />
                  ))}

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
