/** @odoo-module **/

import { onMounted, onPatched } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { browser } from "@web/core/browser/browser";
import { ListRenderer } from "@web/views/list/list_renderer";

/**
 * Persist manually resized list column widths in localStorage, per view —
 * the same client-side approach core uses for optional columns.
 *
 * How it cooperates with the column-width hook (useMagicColumnWidths):
 *  - SAVE: we wrap the hook's onStartResize. When the drag ends (same
 *    stopping events the hook listens to), we read the resulting header
 *    widths and store them, keyed by field name.
 *  - RESTORE: getActiveColumns() overlays the saved widths onto the column
 *    definitions as `attrs.width` — exactly as if `width="123px"` had been
 *    set in the view arch — so the hook's own computation honors them on
 *    every render, window resize and column-set change.
 *  - RESET: double-clicking a column's resize handle forgets the saved
 *    widths for that view and lets Odoo recompute ideal widths.
 */

const STOP_EVENTS = ["keydown", "pointerdown", "pointerup"];

function horizontalPadding(el) {
    const style = getComputedStyle(el);
    return parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
}

patch(ListRenderer.prototype, {
    setup() {
        super.setup();
        this.keyColumnWidths = `column_widths,${this.createViewKey()}`;
        this._savedColumnWidths = this._loadSavedColumnWidths();

        // Wrap the resize starter exposed by the column-width hook so that a
        // completed drag persists the new widths. Guarded: some renderers
        // disable the magic widths entirely.
        const magic = this.columnWidths;
        if (magic && typeof magic.onStartResize === "function") {
            const originalOnStartResize = magic.onStartResize;
            magic.onStartResize = (ev) => {
                originalOnStartResize(ev);
                this._watchResizeEnd();
            };

            // Reset gesture: double-click a resize handle. Bound on the table
            // element (once) since the handles are re-rendered with each patch.
            const bindResetGesture = () => {
                const table = this.tableRef && this.tableRef.el;
                if (table && !table.dataset.cwlResetBound) {
                    table.dataset.cwlResetBound = "1";
                    table.addEventListener("dblclick", (ev) => this._onResizeHandleDblClick(ev));
                }
            };
            onMounted(bindResetGesture);
            onPatched(bindResetGesture);
        }
    },

    /**
     * Overlay saved widths as fixed width specs. Columns with an explicit
     * arch width keep it — the arch is the stronger contract.
     */
    getActiveColumns() {
        const columns = super.getActiveColumns(...arguments);
        const saved = this._savedColumnWidths;
        if (!saved) {
            return columns;
        }
        return columns.map((col) => {
            const width = col.type === "field" && saved[col.name];
            if (!width || (col.attrs && col.attrs.width)) {
                return col;
            }
            return { ...col, attrs: { ...(col.attrs || {}), width: `${width}px` } };
        });
    },

    _loadSavedColumnWidths() {
        try {
            const raw = browser.localStorage.getItem(this.keyColumnWidths);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    /**
     * Listen (after the hook's own stop handlers) for the end of the resize
     * drag, then persist the resulting widths.
     */
    _watchResizeEnd() {
        const finish = (ev) => {
            // Mirror the hook: a left-button pointerdown is the drag itself.
            if (ev.type === "pointerdown" && ev.button === 0) {
                return;
            }
            for (const type of STOP_EVENTS) {
                window.removeEventListener(type, finish);
            }
            this._persistColumnWidths();
        };
        for (const type of STOP_EVENTS) {
            window.addEventListener(type, finish);
        }
    },

    _persistColumnWidths() {
        const table = this.tableRef && this.tableRef.el;
        if (!table) {
            return;
        }
        const widths = {};
        for (const th of table.querySelectorAll("thead th[data-name]")) {
            // Store content width (without padding): that is what the width
            // spec constrains; the hook re-adds cell padding when applying.
            const width = th.getBoundingClientRect().width - horizontalPadding(th);
            if (width > 0) {
                widths[th.dataset.name] = Math.round(width);
            }
        }
        if (!Object.keys(widths).length) {
            return;
        }
        this._savedColumnWidths = widths;
        try {
            browser.localStorage.setItem(this.keyColumnWidths, JSON.stringify(widths));
        } catch {
            // Storage full/blocked — widths simply won't persist.
        }
    },

    /** Double-click on a resize handle: forget saved widths for this view. */
    async _onResizeHandleDblClick(ev) {
        if (!ev.target.closest || !ev.target.closest(".o_resize")) {
            return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        try {
            browser.localStorage.removeItem(this.keyColumnWidths);
        } catch {
            // Ignore storage errors — in-memory reset still applies.
        }
        this._savedColumnWidths = null;
        // Re-render so columns lose the overlaid width specs, then ask the
        // hook to recompute ideal widths from scratch.
        await this.render(true);
        if (this.columnWidths && typeof this.columnWidths.resetWidths === "function") {
            this.columnWidths.resetWidths();
        }
    },
});
