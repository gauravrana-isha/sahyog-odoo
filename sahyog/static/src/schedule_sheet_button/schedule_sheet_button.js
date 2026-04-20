/** @odoo-module **/

import { ListController } from "@web/views/list/list_controller";
import { registry } from "@web/core/registry";

export class ProgramListController extends ListController {
    onScheduleSheetClick() {
        window.open(
            "https://docs.google.com/spreadsheets/d/1lOk_LZ1BYDazrWh0ZZxmis3thv_dnbNI/edit",
            "_blank"
        );
    }
}

registry.category("views").add("program_list_with_sheet", {
    ...registry.category("views").get("list"),
    Controller: ProgramListController,
    buttonTemplate: "sahyog.ProgramListButtons",
});
