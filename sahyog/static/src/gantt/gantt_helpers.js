/** @odoo-module */

/**
 * Pure helper functions for the Sahyog Gantt Timeline Widget.
 * No OWL dependency — uses luxon (globally available in Odoo 19).
 */

const { DateTime } = luxon;

export const ENTRY_COLORS = {
    silence: "#4A90D9",
    break: "#E8943A",
    program: "#5CB85C",
};

const PENDING_STATUSES = ["requested", "pending_admin", "pending_volunteer"];
const TERMINAL_STATUSES = ["done", "cancelled", "dropped"];

/**
 * Returns { start, end } luxon DateTimes for the full month containing `date`.
 */
export function getMonthDateRange(date) {
    const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
    return {
        start: dt.startOf("month"),
        end: dt.endOf("month").startOf("day"),
    };
}

/**
 * Returns { start, end } luxon DateTimes for the Mon–Sun week containing `date`.
 */
export function getWeekDateRange(date) {
    const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
    const start = dt.startOf("week"); // Monday
    const end = start.plus({ days: 6 }); // Sunday
    return { start, end };
}

/**
 * Returns an inclusive array of luxon DateTime objects from `start` to `end`.
 */
export function generateDateArray(start, end) {
    const dates = [];
    let current = start.startOf("day");
    const last = end.startOf("day");
    while (current <= last) {
        dates.push(current);
        current = current.plus({ days: 1 });
    }
    return dates;
}

/**
 * Returns true if the given date is Saturday or Sunday.
 */
export function isWeekend(date) {
    const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
    return dt.weekday === 6 || dt.weekday === 7;
}

/**
 * Returns the day number as a string (e.g. "1", "15", "31").
 */
export function formatDateLabel(date) {
    const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
    return String(dt.day);
}

/**
 * Returns a human-readable period label.
 * Month mode: "April 2026"
 * Week mode: "Apr 7 – Apr 13, 2026"
 */
export function formatPeriodLabel(zoomLevel, date) {
    const dt = DateTime.isDateTime(date) ? date : DateTime.fromJSDate(date);
    if (zoomLevel === "month") {
        return dt.toFormat("LLLL yyyy");
    }
    const { start, end } = getWeekDateRange(dt);
    if (start.year === end.year && start.month === end.month) {
        return `${start.toFormat("LLL d")} – ${end.toFormat("d, yyyy")}`;
    }
    if (start.year === end.year) {
        return `${start.toFormat("LLL d")} – ${end.toFormat("LLL d, yyyy")}`;
    }
    return `${start.toFormat("LLL d, yyyy")} – ${end.toFormat("LLL d, yyyy")}`;
}

/**
 * Given a calendar entry ID from the SQL view, returns { model, recordId }.
 * ID ranges: 1-99999 = silence, 100000-199999 = break, 200000+ = program.
 * Returns null for invalid IDs.
 */
export function resolveSourceModel(calendarEntryId) {
    if (!calendarEntryId || calendarEntryId < 1) {
        return null;
    }
    if (calendarEntryId >= 200000) {
        return { model: "sahyog.volunteer.program", recordId: calendarEntryId - 200000 };
    }
    if (calendarEntryId >= 100000) {
        return { model: "sahyog.break.period", recordId: calendarEntryId - 100000 };
    }
    return { model: "sahyog.silence.period", recordId: calendarEntryId };
}

/**
 * Given an entry type string, returns the write model name.
 */
export function resolveWriteModel(entryType) {
    const map = {
        silence: "sahyog.silence.period",
        break: "sahyog.break.period",
        program: "sahyog.volunteer.program",
    };
    return map[entryType] || null;
}

/**
 * Returns the status field name for the given entry type.
 * silence/break use "status", program uses "completion_status".
 */
export function getStatusField(entryType) {
    return entryType === "program" ? "completion_status" : "status";
}

/**
 * Returns the approve value for the given entry type.
 * silence/break → "approved", program → "upcoming".
 */
export function getApproveValue(entryType) {
    return entryType === "program" ? "upcoming" : "approved";
}

/**
 * Returns the cancel value for the given entry type.
 * silence/break → "cancelled", program → "dropped".
 */
export function getCancelValue(entryType) {
    return entryType === "program" ? "dropped" : "cancelled";
}

/**
 * Returns true if the status is a pending status (approve button should show).
 */
export function isPendingStatus(status) {
    return PENDING_STATUSES.includes(status);
}

/**
 * Returns true if the status is a terminal status (cancel button should NOT show).
 */
export function isTerminalStatus(status) {
    return TERMINAL_STATUSES.includes(status);
}

/**
 * Computes the grid position for an entry bar within the given date array.
 * Returns { startCol, spanCols } or null if the entry is entirely outside the range.
 * startCol is 1-based (CSS grid column numbering, offset by 1 for the name column).
 */
export function computeBarPosition(entry, dateArray) {
    if (!dateArray || dateArray.length === 0) return null;

    const rangeStart = dateArray[0].startOf("day");
    const rangeEnd = dateArray[dateArray.length - 1].startOf("day");

    const entryStart = DateTime.fromISO(entry.start_date).startOf("day");
    const entryEnd = DateTime.fromISO(entry.end_date).startOf("day");

    // No overlap
    if (entryEnd < rangeStart || entryStart > rangeEnd) return null;

    // Clip to visible range
    const visibleStart = entryStart < rangeStart ? rangeStart : entryStart;
    const visibleEnd = entryEnd > rangeEnd ? rangeEnd : entryEnd;

    const startCol = Math.round(visibleStart.diff(rangeStart, "days").days) + 2; // +2: 1-based + name col
    const spanCols = Math.round(visibleEnd.diff(visibleStart, "days").days) + 1; // inclusive

    return { startCol, spanCols };
}

/**
 * Lane packing for overlapping bars within a single volunteer row.
 * Assigns laneIndex to each bar so overlapping bars get distinct lanes.
 * Returns the bars array with laneIndex set on each bar.
 */
export function packLanes(bars) {
    if (!bars || bars.length === 0) return [];

    // Sort by startCol, then by spanCols descending for stable packing
    bars.sort((a, b) => a.startCol - b.startCol || b.spanCols - a.spanCols);

    for (let i = 0; i < bars.length; i++) {
        const usedLanes = new Set();
        for (let j = 0; j < i; j++) {
            // Check overlap: bars overlap if their column ranges intersect
            const aEnd = bars[j].startCol + bars[j].spanCols - 1;
            const bEnd = bars[i].startCol + bars[i].spanCols - 1;
            if (bars[j].startCol <= bEnd && bars[i].startCol <= aEnd) {
                usedLanes.add(bars[j].laneIndex);
            }
        }
        let lane = 0;
        while (usedLanes.has(lane)) lane++;
        bars[i].laneIndex = lane;
    }

    return bars;
}

/**
 * Filters entries by entryTypes and statuses arrays.
 * If an array is empty, all values pass for that dimension.
 */
export function applyFilters(entries, filters) {
    if (!entries) return [];
    const { entryTypes = [], statuses = [] } = filters || {};
    return entries.filter((e) => {
        const typeOk = entryTypes.length === 0 || entryTypes.includes(e.entry_type);
        const statusOk = statuses.length === 0 || statuses.includes(e.status);
        return typeOk && statusOk;
    });
}

/**
 * Computes grid row data with lane packing for overlapping bars.
 * Returns [{ volunteer, bars: [{ entry, startCol, spanCols, laneIndex }] }]
 */
export function computeGridRows(volunteers, entries, dateArray) {
    if (!volunteers || !dateArray || dateArray.length === 0) return [];

    return volunteers.map((volunteer) => {
        const volEntries = entries.filter((e) => {
            const volId = Array.isArray(e.volunteer_id) ? e.volunteer_id[0] : e.volunteer_id;
            return volId === volunteer.id;
        });

        const bars = [];
        for (const entry of volEntries) {
            const pos = computeBarPosition(entry, dateArray);
            if (!pos) continue;
            bars.push({ entry, startCol: pos.startCol, spanCols: pos.spanCols, laneIndex: 0 });
        }

        packLanes(bars);

        return { volunteer, bars };
    });
}

/**
 * Computes new start/end dates after a drag-move, preserving duration.
 */
export function computeDragMoveDates(originalStart, originalEnd, dayOffset) {
    const start = DateTime.fromISO(originalStart);
    const end = DateTime.fromISO(originalEnd);
    return {
        newStart: start.plus({ days: dayOffset }).toISODate(),
        newEnd: end.plus({ days: dayOffset }).toISODate(),
    };
}
