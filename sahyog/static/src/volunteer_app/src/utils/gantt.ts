import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWeekend as dfIsWeekend,
  format,
  parseISO,
  differenceInCalendarDays,
  isBefore,
  isAfter,
  isSameDay,
} from 'date-fns';
import type { CalendarEntry } from '../types';

/** Colors matching the admin Gantt widget */
export const ENTRY_COLORS: Record<string, string> = {
  silence: '#4A90D9',
  break: '#E8943A',
  program: '#5CB85C',
};

/** Generate an inclusive array of dates from start to end */
export function generateDateArray(start: Date, end: Date): Date[] {
  if (isAfter(start, end)) return [];
  return eachDayOfInterval({ start, end });
}

/** Get the first and last day of the month containing `date` */
export function getMonthDateRange(date: Date): { start: Date; end: Date } {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

/** Get Monday–Sunday of the week containing `date` */
export function getWeekDateRange(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

/** Check if a date is Saturday or Sunday */
export function isWeekend(date: Date): boolean {
  return dfIsWeekend(date);
}

/** Format a date for the column header */
export function formatDateLabel(date: Date, zoomLevel: 'month' | 'week', compact = false): string {
  if (zoomLevel === 'week') {
    // compact: "M 7", normal: "Mon 7"
    if (compact) {
      return format(date, 'EEEEE d'); // single letter: M, T, W, T, F, S, S + day
    }
    return format(date, 'EEE d'); // e.g. "Mon 7"
  }
  return format(date, 'd'); // e.g. "7"
}

/** Format the period label */
export function formatPeriodLabel(zoomLevel: 'month' | 'week', date: Date): string {
  if (zoomLevel === 'month') {
    return format(date, 'MMMM yyyy');
  }
  const { start, end } = getWeekDateRange(date);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear && sameMonth) {
    return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
  }
  if (sameYear) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`;
}


/**
 * Compute bar position within the date range.
 * Returns { startCol, spanCols } or null if entry doesn't overlap the range.
 * startCol is 0-based index into the dateArray.
 */
export function computeBarPosition(
  entry: { start_date: string; end_date: string },
  dateArray: Date[],
): { startCol: number; spanCols: number } | null {
  if (!dateArray || dateArray.length === 0) return null;

  const rangeStart = dateArray[0];
  const rangeEnd = dateArray[dateArray.length - 1];

  const entryStart = parseISO(entry.start_date);
  const entryEnd = parseISO(entry.end_date);

  // No overlap
  if (isBefore(entryEnd, rangeStart) && !isSameDay(entryEnd, rangeStart)) return null;
  if (isAfter(entryStart, rangeEnd) && !isSameDay(entryStart, rangeEnd)) return null;

  // Clip to visible range
  const visibleStart = isBefore(entryStart, rangeStart) ? rangeStart : entryStart;
  const visibleEnd = isAfter(entryEnd, rangeEnd) ? rangeEnd : entryEnd;

  const startCol = differenceInCalendarDays(visibleStart, rangeStart);
  const spanCols = differenceInCalendarDays(visibleEnd, visibleStart) + 1;

  return { startCol, spanCols };
}

/** Bar data with lane assignment */
export interface BarData {
  startCol: number;
  spanCols: number;
  laneIndex: number;
  entry: CalendarEntry;
}

/**
 * Pack bars into lanes so overlapping bars don't overlap visually.
 */
export function packLanes(bars: Omit<BarData, 'laneIndex'>[]): BarData[] {
  if (!bars || bars.length === 0) return [];

  const sorted = [...bars].sort((a, b) => a.startCol - b.startCol || b.spanCols - a.spanCols);
  const result: BarData[] = sorted.map((b) => ({ ...b, laneIndex: 0 }));

  for (let i = 0; i < result.length; i++) {
    const usedLanes = new Set<number>();
    for (let j = 0; j < i; j++) {
      const aEnd = result[j].startCol + result[j].spanCols - 1;
      const bEnd = result[i].startCol + result[i].spanCols - 1;
      if (result[j].startCol <= bEnd && result[i].startCol <= aEnd) {
        usedLanes.add(result[j].laneIndex);
      }
    }
    let lane = 0;
    while (usedLanes.has(lane)) lane++;
    result[i].laneIndex = lane;
  }

  return result;
}

/**
 * Compute grid rows: for each volunteer, compute their bars with positions and lanes.
 */
export function computeGridRows(
  volunteers: { id: number; name: string; volunteer_type_ids?: number[] }[],
  entries: CalendarEntry[],
  dateArray: Date[],
): { volunteer: { id: number; name: string; volunteer_type_ids?: number[] }; bars: BarData[] }[] {
  if (!volunteers || !dateArray || dateArray.length === 0) return [];

  return volunteers.map((volunteer) => {
    const volEntries = entries.filter((e) => e.volunteer_id === volunteer.id);

    const rawBars: Omit<BarData, 'laneIndex'>[] = [];
    for (const entry of volEntries) {
      const pos = computeBarPosition(entry, dateArray);
      if (!pos) continue;
      rawBars.push({ entry, startCol: pos.startCol, spanCols: pos.spanCols });
    }

    const bars = packLanes(rawBars);
    return { volunteer, bars };
  });
}
