/** @odoo-module */
import { Component, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class SahyogDashboard extends Component {
    static template = "sahyog.SahyogDashboard";

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.state = useState({
            totalActive: 0,
            onSilence: 0,
            onBreak: 0,
            onProgram: 0,
            away: 0,
            guestCare: 0,
            guestCareAvailable: 0,
            todaySilences: [],
            todayBreaks: [],
            todayPrograms: [],
        });
        onWillStart(async () => {
            await this.loadData();
        });
    }

    async loadData() {
        // Summary counts — exclude both 'away' and 'left' for active count
        const employees = await this.orm.searchRead(
            "hr.employee",
            [["base_status", "not in", ["away", "left"]]],
            ["computed_status", "work_mode", "base_status"],
        );

        this.state.totalActive = employees.length;
        this.state.onSilence = employees.filter(
            (e) => e.computed_status === "On Silence"
        ).length;
        this.state.onBreak = employees.filter(
            (e) => e.computed_status === "On Break"
        ).length;
        this.state.onProgram = employees.filter(
            (e) => e.computed_status === "On Program"
        ).length;

        // Guest Care: total and available
        const allEmployees = await this.orm.searchRead(
            "hr.employee",
            [["base_status", "!=", "left"]],
            ["computed_status", "work_mode", "base_status"],
        );
        const guestCareAll = allEmployees.filter((e) => e.work_mode === "guest_care");
        this.state.guestCare = guestCareAll.length;
        this.state.guestCareAvailable = guestCareAll.filter(
            (e) => e.computed_status === "Available"
        ).length;

        // Away count (base_status = 'away')
        this.state.away = allEmployees.filter(
            (e) => e.base_status === "away"
        ).length;

        // Today's active entries
        const today = new Date().toISOString().split("T")[0];

        this.state.todaySilences = await this.orm.searchRead(
            "sahyog.silence.period",
            [
                ["start_date", "<=", today],
                ["end_date", ">=", today],
                ["status", "in", ["approved", "on_going"]],
            ],
            ["volunteer_id", "silence_type", "start_date", "end_date", "status"],
        );

        this.state.todayBreaks = await this.orm.searchRead(
            "sahyog.break.period",
            [
                ["start_date", "<=", today],
                ["end_date", ">=", today],
                ["status", "in", ["approved", "on_going"]],
            ],
            ["volunteer_id", "break_type", "start_date", "end_date", "status"],
        );

        this.state.todayPrograms = await this.orm.searchRead(
            "sahyog.volunteer.program",
            [
                ["start_date", "<=", today],
                ["end_date", ">=", today],
                ["completion_status", "=", "upcoming"],
            ],
            ["volunteer_id", "program_id", "start_date", "end_date", "completion_status"],
        );
    }

    // ---- Click handlers for daily entries ----
    openSilenceRecord(silenceId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "sahyog.silence.period",
            res_id: silenceId,
            views: [[false, "form"]],
            target: "current",
        });
    }

    openBreakRecord(breakId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "sahyog.break.period",
            res_id: breakId,
            views: [[false, "form"]],
            target: "current",
        });
    }

    openProgramRecord(programId) {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "sahyog.volunteer.program",
            res_id: programId,
            views: [[false, "form"]],
            target: "current",
        });
    }

    // ---- Quick Links ----
    onAddVolunteer() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hr.employee",
            views: [[false, "form"]],
            target: "current",
        });
    }

    onTeamCalendar() {
        this.action.doAction("sahyog.action_calendar_entry", { clearBreadcrumbs: false });
    }

    onManagePrograms() {
        this.action.doAction({
            type: "ir.actions.act_window",
            name: "Programs",
            res_model: "sahyog.program",
            view_mode: "list,form",
            views: [[false, "list"], [false, "form"]],
            target: "current",
        });
    }
}

registry.category("actions").add("sahyog_dashboard", SahyogDashboard);
