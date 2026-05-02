/** @odoo-module */
import { Component, onWillStart, useState, useRef, onMounted, onWillUnmount } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import {
    ENTRY_COLORS,
    getMonthDateRange,
    getWeekDateRange,
    generateDateArray,
    isWeekend,
    formatDateLabel,
    formatPeriodLabel,
    resolveSourceModel,
    resolveWriteModel,
    getStatusField,
    getApproveValue,
    getCancelValue,
    computeBarPosition,
    computeGridRows,
    applyFilters,
    isPendingStatus,
    isTerminalStatus,
    computeDragMoveDates,
} from "./gantt_helpers";

export class SahyogGanttTimeline extends Component {
    static template = "sahyog.GanttTimeline";

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.gridRef = useRef("grid");

        this.state = useState({
            zoomLevel: "month",
            currentDate: luxon.DateTime.now(),
            volunteers: [],
            entries: [],
            volunteerTypes: [],
            selectedVolunteerTypeIds: [],
            entryTypeFilter: '',
            selectedEntryTypes: [],
            entryTypeDropdownOpen: false,
            volunteerTypeDropdownOpen: false,
            filters: {
                entryTypes: [],
                statuses: [],
            },
            tooltip: { visible: false, entry: null, x: 0, y: 0 },
            popover: { visible: false, entry: null, x: 0, y: 0 },
            dialog: { visible: false, volunteerId: null, startDate: null, endDate: null },
            drag: {
                active: false,
                type: null,       // "move" | "resize" | "create"
                entryId: null,
                startCol: null,
                currentCol: null,
                startRow: null,
                currentRow: null,
                originalEntry: null,
                volunteerId: null,
                startDate: null,
                startX: 0,
                currentX: 0,
            },
            loading: false,
        });

        // Bound handlers for document-level events
        this._onMouseMove = this.onDragMove.bind(this);
        this._onMouseUp = this.onDragEnd.bind(this);
        this._onKeyDown = this._handleKeyDown.bind(this);
        this._onClickOutside = this._handleClickOutside.bind(this);
        this._dragJustEnded = false;
        this._preventSelect = (e) => e.preventDefault();

        onWillStart(async () => {
            await this.loadData();
        });

        onMounted(() => {
            document.addEventListener("mousemove", this._onMouseMove);
            document.addEventListener("mouseup", this._onMouseUp);
            document.addEventListener("keydown", this._onKeyDown);
            document.addEventListener("click", this._onClickOutside, true);
        });

        onWillUnmount(() => {
            document.removeEventListener("mousemove", this._onMouseMove);
            document.removeEventListener("mouseup", this._onMouseUp);
            document.removeEventListener("keydown", this._onKeyDown);
            document.removeEventListener("click", this._onClickOutside, true);
        });
    }

    // ---- Helpers exposed to template ----
    get ENTRY_COLORS() { return ENTRY_COLORS; }
    isWeekend(date) { return isWeekend(date); }
    formatDateLabel(date) { return formatDateLabel(date); }
    isPendingStatus(status) { return isPendingStatus(status); }
    isTerminalStatus(status) { return isTerminalStatus(status); }

    // ---- Computed getters ----
    get dateRange() {
        const { zoomLevel, currentDate } = this.state;
        const range = zoomLevel === "month"
            ? getMonthDateRange(currentDate)
            : getWeekDateRange(currentDate);
        return generateDateArray(range.start, range.end);
    }

    get periodLabel() {
        return formatPeriodLabel(this.state.zoomLevel, this.state.currentDate);
    }

    get filteredEntries() {
        let entries = this.state.entries;
        const selected = this.state.selectedEntryTypes;
        if (selected.length > 0) {
            entries = entries.filter(e => selected.includes(e.entry_type));
        }
        return entries;
    }

    get visibleVolunteers() {
        let vols = this.state.volunteers;

        // Filter by volunteer type
        const typeIds = this.state.selectedVolunteerTypeIds;
        if (typeIds.length > 0) {
            vols = vols.filter(v => {
                const volTypeIds = v.volunteer_type_ids || [];
                return typeIds.some(tid => volTypeIds.includes(tid));
            });
        }

        // Filter by entry type
        const selectedTypes = this.state.selectedEntryTypes;
        let filtered = this.state.entries;
        if (selectedTypes.length > 0) {
            filtered = filtered.filter(e => selectedTypes.includes(e.entry_type));
        }

        // If any filter is active, only show volunteers with matching entries
        if (selectedTypes.length > 0 || typeIds.length > 0) {
            const volIds = new Set(filtered.map(e => Array.isArray(e.volunteer_id) ? e.volunteer_id[0] : e.volunteer_id));
            vols = vols.filter(v => volIds.has(v.id));
        }

        return vols;
    }

    get gridRows() {
        return computeGridRows(this.visibleVolunteers, this.filteredEntries, this.dateRange);
    }

    get todayColumnIndex() {
        const today = luxon.DateTime.now().startOf("day");
        const dates = this.dateRange;
        for (let i = 0; i < dates.length; i++) {
            if (dates[i].hasSame(today, "day")) return i;
        }
        return -1;
    }

    get gridTemplateColumns() {
        return `180px repeat(${this.dateRange.length}, minmax(30px, 1fr))`;
    }

    get colWidth() {
        // Use percentage-based positioning instead of fixed pixels
        // This is used for bar positioning calculations
        return 0; // Not used for CSS — we use flex layout
    }

    get gridMinWidth() {
        // Minimum width: 180px name + 30px per day
        return 180 + this.dateRange.length * 30;
    }

    // ---- Data loading ----
    async loadData() {
        await this.safeOrmCall(async () => {
            const range = this.state.zoomLevel === "month"
                ? getMonthDateRange(this.state.currentDate)
                : getWeekDateRange(this.state.currentDate);

            const [volunteers, entries, volunteerTypes] = await Promise.all([
                this.orm.searchRead(
                    "hr.employee",
                    [["base_status", "not in", ["left", "away"]]],
                    ["id", "name", "volunteer_type_ids"],
                ),
                this.orm.searchRead(
                    "sahyog.calendar.entry",
                    [
                        ["start_date", "<=", range.end.toISODate()],
                        ["end_date", ">=", range.start.toISODate()],
                    ],
                    ["id", "volunteer_id", "entry_type", "name", "start_date", "end_date", "status"],
                ),
                this.orm.searchRead(
                    "sahyog.volunteer.type",
                    [],
                    ["id", "name"],
                ),
            ]);

            this.state.volunteers = volunteers;
            this.state.entries = entries;
            this.state.volunteerTypes = volunteerTypes;
        });
    }

    async refreshEntries() {
        await this.safeOrmCall(async () => {
            const range = this.state.zoomLevel === "month"
                ? getMonthDateRange(this.state.currentDate)
                : getWeekDateRange(this.state.currentDate);

            this.state.entries = await this.orm.searchRead(
                "sahyog.calendar.entry",
                [
                    ["start_date", "<=", range.end.toISODate()],
                    ["end_date", ">=", range.start.toISODate()],
                ],
                ["id", "volunteer_id", "entry_type", "name", "start_date", "end_date", "status"],
            );
        });
    }

    async safeOrmCall(fn) {
        try {
            this.state.loading = true;
            return await fn();
        } catch (e) {
            this.notification.add(e.message || "Operation failed", { type: "danger" });
            return null;
        } finally {
            this.state.loading = false;
        }
    }

    // ---- Navigation ----
    onPrevious() {
        if (this.state.zoomLevel === "month") {
            this.state.currentDate = this.state.currentDate.minus({ months: 1 });
        } else {
            this.state.currentDate = this.state.currentDate.minus({ days: 7 });
        }
        this.loadData();
    }

    onNext() {
        if (this.state.zoomLevel === "month") {
            this.state.currentDate = this.state.currentDate.plus({ months: 1 });
        } else {
            this.state.currentDate = this.state.currentDate.plus({ days: 7 });
        }
        this.loadData();
    }

    onToday() {
        this.state.currentDate = luxon.DateTime.now();
        this.loadData();
    }

    onZoomChange(level) {
        if (this.state.zoomLevel !== level) {
            this.state.zoomLevel = level;
            this.loadData();
        }
    }

    // ---- View switching ----
    onSwitchToCalendar() {
        this.action.doAction("sahyog.action_calendar_entry", { clearBreadcrumbs: true });
    }

    onSwitchToList() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Team Calendar",
            res_model: "sahyog.calendar.entry",
            view_mode: "list",
            views: [[false, "list"]],
            target: "current",
        });
    }

    // ---- Filters ----
    onEntryTypeToggle(type) {
        const types = this.state.selectedEntryTypes;
        const idx = types.indexOf(type);
        if (idx >= 0) {
            types.splice(idx, 1);
        } else {
            types.push(type);
        }
    }

    toggleEntryTypeDropdown() {
        this.state.entryTypeDropdownOpen = !this.state.entryTypeDropdownOpen;
        this.state.volunteerTypeDropdownOpen = false;
    }

    clearEntryTypeFilter() {
        this.state.selectedEntryTypes = [];
        this.state.entryTypeDropdownOpen = false;
    }

    onVolunteerTypeToggle(typeId) {
        const ids = this.state.selectedVolunteerTypeIds;
        const idx = ids.indexOf(typeId);
        if (idx >= 0) {
            ids.splice(idx, 1);
        } else {
            ids.push(typeId);
        }
    }

    toggleVolunteerTypeDropdown() {
        this.state.volunteerTypeDropdownOpen = !this.state.volunteerTypeDropdownOpen;
        this.state.entryTypeDropdownOpen = false;
    }

    clearVolunteerTypeFilter() {
        this.state.selectedVolunteerTypeIds = [];
        this.state.volunteerTypeDropdownOpen = false;
    }

    onFilterEntryType(type) {
        const types = this.state.filters.entryTypes;
        const idx = types.indexOf(type);
        if (idx >= 0) {
            types.splice(idx, 1);
        } else {
            types.push(type);
        }
    }

    onFilterStatus(status) {
        const statuses = this.state.filters.statuses;
        const idx = statuses.indexOf(status);
        if (idx >= 0) {
            statuses.splice(idx, 1);
        } else {
            statuses.push(status);
        }
    }

    // ---- Tooltip ----
    onBarMouseEnter(entry, ev) {
        this.state.tooltip = {
            visible: true,
            entry,
            x: Math.min(ev.clientX + 12, window.innerWidth - 300),
            y: Math.min(ev.clientY + 12, window.innerHeight - 200),
        };
    }

    onBarMouseLeave() {
        this.state.tooltip = { visible: false, entry: null, x: 0, y: 0 };
    }

    // ---- Bar click → Popover ----
    onBarClick(entry, ev) {
        ev.stopPropagation();
        if (this.state.drag.active || this._dragJustEnded) {
            this._dragJustEnded = false;
            return;
        }
        this.state.popover = {
            visible: true,
            entry,
            x: Math.min(ev.clientX, window.innerWidth - 280),
            y: ev.clientY,
        };
        this.state.tooltip.visible = false;
    }

    onPopoverOpen() {
        const entry = this.state.popover.entry;
        if (!entry) return;
        const source = resolveSourceModel(entry.id);
        if (!source) return;
        try {
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: source.model,
                res_id: source.recordId,
                views: [[false, "form"]],
                target: "current",
            });
        } catch (e) {
            this.notification.add("Could not open record", { type: "warning" });
        }
        this.onPopoverClose();
    }

    async onPopoverApprove() {
        const entry = this.state.popover.entry;
        if (!entry) return;
        const source = resolveSourceModel(entry.id);
        if (!source) return;

        const statusField = getStatusField(entry.entry_type);
        const approveValue = getApproveValue(entry.entry_type);

        await this.safeOrmCall(async () => {
            await this.orm.write(source.model, [source.recordId], { [statusField]: approveValue });
        });
        this.onPopoverClose();
        await this.refreshEntries();
    }

    async onPopoverCancel() {
        const entry = this.state.popover.entry;
        if (!entry) return;
        const source = resolveSourceModel(entry.id);
        if (!source) return;

        const statusField = getStatusField(entry.entry_type);
        const cancelValue = getCancelValue(entry.entry_type);

        await this.safeOrmCall(async () => {
            await this.orm.write(source.model, [source.recordId], { [statusField]: cancelValue });
        });
        this.onPopoverClose();
        await this.refreshEntries();
    }

    onPopoverClose() {
        this.state.popover = { visible: false, entry: null, x: 0, y: 0 };
    }

    // ---- Cell click → Dialog ----
    onCellClick(volunteerId, date, ev) {
        if (this.state.drag.active || this._dragJustEnded) {
            this._dragJustEnded = false;
            return;
        }
        ev.stopPropagation();
        this.state.dialog = {
            visible: true,
            volunteerId,
            startDate: date.toISODate(),
            endDate: date.toISODate(),
        };
    }

    onDialogSelect(entryType) {
        const { volunteerId, startDate, endDate } = this.state.dialog;
        const model = resolveWriteModel(entryType);
        if (!model) return;

        const context = {
            default_volunteer_id: volunteerId,
            default_start_date: startDate,
        };
        if (endDate && endDate !== startDate) {
            context.default_end_date = endDate;
        }

        try {
            this.action.doAction({
                type: "ir.actions.act_window",
                res_model: model,
                views: [[false, "form"]],
                target: "current",
                context,
            });
        } catch (e) {
            this.notification.add("Could not open creation form", { type: "warning" });
        }
        this.onDialogClose();
    }

    onDialogClose() {
        this.state.dialog = { visible: false, volunteerId: null, startDate: null, endDate: null };
    }

    // ---- Drag handlers ----

    /**
     * Resolves a clientX position to a column index (0-based day index) within the grid.
     * Returns -1 if outside the grid.
     */
    _resolveColumnFromX(clientX) {
        const gridEl = this.gridRef.el;
        if (!gridEl) return -1;
        const cells = gridEl.querySelectorAll(".gantt-day-header");
        if (!cells.length) return -1;
        for (let i = 0; i < cells.length; i++) {
            const rect = cells[i].getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right) return i;
        }
        // Clamp to edges
        const firstRect = cells[0].getBoundingClientRect();
        if (clientX < firstRect.left) return 0;
        return cells.length - 1;
    }

    /**
     * Resolves a clientY position to a volunteer row index (0-based) within the grid.
     */
    _resolveRowFromY(clientY) {
        const gridEl = this.gridRef.el;
        if (!gridEl) return -1;
        const nameCols = gridEl.querySelectorAll(".gantt-name-col:not(.header)");
        for (let i = 0; i < nameCols.length; i++) {
            const rect = nameCols[i].getBoundingClientRect();
            if (clientY >= rect.top && clientY <= rect.bottom) return i;
        }
        return -1;
    }

    onDragStart(entry, edge, ev) {
        ev.preventDefault();
        ev.stopPropagation();
        document.addEventListener("selectstart", this._preventSelect);
        document.body.style.cursor = edge === "right" ? "ew-resize" : "grabbing";
        const dates = this.dateRange;
        const pos = computeBarPosition(entry, dates);
        if (!pos) return;

        const colIndex = this._resolveColumnFromX(ev.clientX);

        this.state.drag = {
            active: true,
            type: edge === "right" ? "resize" : "move",
            entryId: entry.id,
            startCol: colIndex,
            currentCol: colIndex,
            startRow: this._resolveRowFromY(ev.clientY),
            currentRow: this._resolveRowFromY(ev.clientY),
            originalEntry: { ...entry },
            volunteerId: Array.isArray(entry.volunteer_id) ? entry.volunteer_id[0] : entry.volunteer_id,
            startDate: null,
            startX: ev.clientX,
            currentX: ev.clientX,
        };
        this.state.tooltip.visible = false;
        this.state.popover.visible = false;
    }

    onCellDragStart(volunteerId, date, ev) {
        if (ev.button !== 0) return; // left click only
        ev.preventDefault();
        document.addEventListener("selectstart", this._preventSelect);
        document.body.style.cursor = "crosshair";
        this.state.drag = {
            active: true,
            type: "create",
            entryId: null,
            startCol: this._resolveColumnFromX(ev.clientX),
            currentCol: this._resolveColumnFromX(ev.clientX),
            startRow: null,
            currentRow: null,
            originalEntry: null,
            volunteerId,
            startDate: date.toISODate(),
            startX: ev.clientX,
            currentX: ev.clientX,
        };
    }

    onDragMove(ev) {
        if (!this.state.drag.active) return;
        this.state.drag.currentX = ev.clientX;
        this.state.drag.currentCol = this._resolveColumnFromX(ev.clientX);
        this.state.drag.currentRow = this._resolveRowFromY(ev.clientY);
    }

    async onDragEnd(ev) {
        if (!this.state.drag.active) return;
        const drag = { ...this.state.drag };
        const dates = this.dateRange;

        const colDelta = drag.currentCol - drag.startCol;
        const movedSignificantly = Math.abs(drag.currentX - drag.startX) > 15;

        // Flag to prevent click from firing after a real drag
        if (movedSignificantly) {
            this._dragJustEnded = true;
            setTimeout(() => { this._dragJustEnded = false; }, 50);
        }

        // Reset drag state
        this._resetDrag();

        if (drag.type === "create") {
            if (movedSignificantly && colDelta !== 0) {
                // Drag-to-create: compute start/end dates from columns
                const minCol = Math.min(drag.startCol, drag.currentCol);
                const maxCol = Math.max(drag.startCol, drag.currentCol);
                const startDate = dates[Math.max(0, minCol)];
                const endDate = dates[Math.min(dates.length - 1, maxCol)];
                this.state.dialog = {
                    visible: true,
                    volunteerId: drag.volunteerId,
                    startDate: startDate.toISODate(),
                    endDate: endDate.toISODate(),
                };
            }
            // Single click on cell — handled by onCellClick, not here
            return;
        }

        if (!movedSignificantly) return; // No significant movement

        const entry = drag.originalEntry;
        if (!entry) return;

        if (drag.type === "move") {
            const { newStart, newEnd } = computeDragMoveDates(entry.start_date, entry.end_date, colDelta);
            await this.updateEntryDates(entry, newStart, newEnd, null);
        } else if (drag.type === "resize") {
            // Resize: change end date
            const entryStart = luxon.DateTime.fromISO(entry.start_date).startOf("day");
            const rangeStart = dates[0].startOf("day");
            const originalEndCol = Math.round(luxon.DateTime.fromISO(entry.end_date).startOf("day").diff(rangeStart, "days").days);
            const newEndCol = originalEndCol + colDelta;
            const clampedEndCol = Math.max(
                Math.round(entryStart.diff(rangeStart, "days").days),
                Math.min(newEndCol, dates.length - 1)
            );
            const newEnd = dates[clampedEndCol].toISODate();
            await this.updateEntryDates(entry, entry.start_date, newEnd, null);
        }
    }

    _resetDrag() {
        document.removeEventListener("selectstart", this._preventSelect);
        document.body.style.cursor = "";
        this.state.drag = {
            active: false, type: null, entryId: null,
            startCol: null, currentCol: null, startRow: null, currentRow: null,
            originalEntry: null, volunteerId: null, startDate: null,
            startX: 0, currentX: 0,
        };
    }

    _handleKeyDown(ev) {
        if (ev.key === "Escape") {
            if (this.state.drag.active) this._resetDrag();
            if (this.state.popover.visible) this.onPopoverClose();
            if (this.state.dialog.visible) this.onDialogClose();
        }
    }

    _handleClickOutside(ev) {
        if (this.state.popover.visible) {
            const target = ev.target;
            if (!target.closest(".gantt-popover") && !target.closest(".gantt-bar")) {
                this.onPopoverClose();
            }
        }
        // Close dropdowns when clicking outside
        if (this.state.volunteerTypeDropdownOpen || this.state.entryTypeDropdownOpen) {
            const target = ev.target;
            if (!target.closest(".gantt-filter")) {
                this.state.volunteerTypeDropdownOpen = false;
                this.state.entryTypeDropdownOpen = false;
            }
        }
    }

    // ---- Mutations ----
    async updateEntryDates(entry, newStart, newEnd, newVolunteerId) {
        const source = resolveSourceModel(entry.id);
        if (!source) return;

        const vals = {
            start_date: newStart,
            end_date: newEnd,
        };
        if (newVolunteerId) {
            vals.volunteer_id = newVolunteerId;
        }

        const result = await this.safeOrmCall(async () => {
            await this.orm.write(source.model, [source.recordId], vals);
        });
        if (result === null) {
            // ORM failed — data stays as-is (safeOrmCall showed notification)
            return;
        }
        await this.refreshEntries();
    }

    // ---- Template helpers ----
    getBarStyle(bar, rowIndex) {
        const color = ENTRY_COLORS[bar.entry.entry_type] || "#999";
        const top = bar.laneIndex * 28 + 2;
        const isDragging = this.state.drag.active && this.state.drag.entryId === bar.entry.id;
        const opacity = isDragging ? "opacity: 0.5;" : "";
        return `grid-column: ${bar.startCol} / span ${bar.spanCols}; grid-row: ${rowIndex + 2}; background: ${color}; top: ${top}px; ${opacity}`;
    }

    getBarStyleAbs(bar) {
        const totalDays = this.dateRange.length;
        const color = ENTRY_COLORS[bar.entry.entry_type] || "#999";
        const dayIndex = bar.startCol - 2; // convert from 2-based to 0-based
        const top = bar.laneIndex * 26 + 4;
        const drag = this.state.drag;
        const isDragging = drag.active && drag.entryId === bar.entry.id;

        let leftPct, widthPct;

        if (isDragging && drag.type === "move") {
            const colDelta = drag.currentCol - drag.startCol;
            const newDayIndex = Math.max(0, Math.min(dayIndex + colDelta, totalDays - bar.spanCols));
            leftPct = (newDayIndex / totalDays) * 100;
            widthPct = (bar.spanCols / totalDays) * 100;
        } else if (isDragging && drag.type === "resize") {
            const colDelta = drag.currentCol - drag.startCol;
            const newSpan = Math.max(1, bar.spanCols + colDelta);
            leftPct = (dayIndex / totalDays) * 100;
            widthPct = (Math.min(newSpan, totalDays - dayIndex) / totalDays) * 100;
        } else {
            leftPct = (dayIndex / totalDays) * 100;
            widthPct = (bar.spanCols / totalDays) * 100;
        }

        const opacity = isDragging ? "opacity:0.7;" : "";
        const outline = isDragging ? "outline:2px dashed rgba(0,0,0,0.3);outline-offset:-1px;" : "";
        return `left:${leftPct}%;width:${Math.max(widthPct, (1 / totalDays) * 100)}%;top:${top}px;background:${color};${opacity}${outline}`;
    }

    getRowMinHeight(row) {
        if (!row.bars || row.bars.length === 0) return "36px";
        const maxLane = Math.max(...row.bars.map((b) => b.laneIndex));
        return `${(maxLane + 1) * 26 + 12}px`;
    }

    getVolunteerName(entry) {
        if (!entry) return "";
        if (Array.isArray(entry.volunteer_id)) return entry.volunteer_id[1] || "";
        return "";
    }

    getEntryLabel(entry) {
        if (!entry || !entry.name) return "";
        const parts = entry.name.split(" — ");
        return parts.length > 1 ? parts[1] : entry.name;
    }
}

registry.category("actions").add("sahyog_gantt_timeline", SahyogGanttTimeline);
