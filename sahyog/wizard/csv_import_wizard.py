import base64
import csv
import io

from odoo import fields, models
from odoo.exceptions import UserError


class CsvImportWizard(models.TransientModel):
    _name = 'sahyog.csv.import.wizard'
    _description = 'CSV Import Wizard for Program Schedules'

    csv_file = fields.Binary(string='CSV File', required=True)
    csv_filename = fields.Char(string='Filename')

    def action_import(self):
        """Parse uploaded CSV and create program.schedule records."""
        self.ensure_one()
        if not self.csv_file:
            raise UserError("Please upload a CSV file.")

        # Decode the binary field
        try:
            raw = base64.b64decode(self.csv_file)
            content = raw.decode('utf-8-sig')
        except Exception:
            raise UserError("Unable to read the CSV file. Please ensure it is a valid UTF-8 CSV.")

        reader = csv.reader(io.StringIO(content))
        headers = next(reader, None)
        if not headers:
            raise UserError("The CSV file is empty or has no header row.")

        # Normalize headers (strip whitespace, lowercase)
        headers = [h.strip().lower() for h in headers]
        expected = [
            'program name', 'start date', 'end date', 'start time',
            'end time', 'status', 'location', 'capacity', 'fee', 'notes',
        ]
        if headers != expected:
            raise UserError(
                "CSV columns do not match expected format.\n"
                "Expected: Program Name, Start Date, End Date, Start Time, "
                "End Time, Status, Location, Capacity, Fee, Notes"
            )

        Program = self.env['sahyog.program']
        Schedule = self.env['sahyog.program.schedule']

        created_ids = []
        errors = []

        status_map = {
            'planning': 'planning',
            'upcoming': 'upcoming',
            'completed': 'completed',
        }

        for row_num, row in enumerate(reader, start=2):
            if len(row) != 10:
                errors.append(f"Row {row_num}: expected 10 columns, got {len(row)}.")
                continue

            (program_name, start_date, end_date, start_time,
             end_time, status, location, capacity, fee, notes) = [
                v.strip() for v in row
            ]

            if not program_name:
                errors.append(f"Row {row_num}: Program Name is empty.")
                continue

            # Match program by name (case-insensitive)
            program = Program.search([('name', 'ilike', program_name)], limit=1)
            if not program:
                errors.append(f"Row {row_num}: No program found matching '{program_name}'.")
                continue

            # Validate dates
            if not start_date or not end_date:
                errors.append(f"Row {row_num}: Start Date and End Date are required.")
                continue

            # Parse capacity
            cap_val = 0
            if capacity:
                try:
                    cap_val = int(capacity)
                except ValueError:
                    errors.append(f"Row {row_num}: Capacity '{capacity}' is not a valid integer.")
                    continue

            # Map status
            schedule_status = status_map.get(status.lower(), 'planning') if status else 'planning'

            try:
                rec = Schedule.create({
                    'program_id': program.id,
                    'start_date': start_date,
                    'end_date': end_date,
                    'start_time': start_time or False,
                    'end_time': end_time or False,
                    'schedule_status': schedule_status,
                    'location': location or False,
                    'capacity': cap_val,
                    'fee': fee or False,
                    'notes': notes or False,
                })
                created_ids.append(rec.id)
            except Exception as e:
                errors.append(f"Row {row_num}: Failed to create schedule — {e}")

        if errors and not created_ids:
            raise UserError("No records were created.\n\n" + "\n".join(errors))

        if errors:
            raise UserError(
                f"{len(created_ids)} schedule(s) created, but some rows had errors:\n\n"
                + "\n".join(errors)
            )

        # Return action showing created records
        return {
            'type': 'ir.actions.act_window',
            'name': 'Imported Schedules',
            'res_model': 'sahyog.program.schedule',
            'view_mode': 'tree,form',
            'domain': [('id', 'in', created_ids)],
            'target': 'current',
        }
