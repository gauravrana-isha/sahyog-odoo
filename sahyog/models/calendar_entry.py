from odoo import fields, models, tools


class CalendarEntry(models.Model):
    _name = 'sahyog.calendar.entry'
    _description = 'Unified Calendar Entry'
    _auto = False  # SQL view, not a real table
    _order = 'start_date desc'

    volunteer_id = fields.Many2one('hr.employee', string='Volunteer', readonly=True)
    entry_type = fields.Selection([
        ('silence', 'Silence'),
        ('break', 'Break'),
        ('program', 'Program'),
    ], string='Type', readonly=True)
    name = fields.Char(string='Description', readonly=True)
    start_date = fields.Date(readonly=True)
    end_date = fields.Date(readonly=True)
    status = fields.Char(readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT
                    sp.id AS id,
                    sp.volunteer_id,
                    'silence' AS entry_type,
                    COALESCE(e.name, 'Unknown') || ' — ' ||
                        CASE sp.silence_type
                            WHEN 'personal' THEN 'Personal Silence'
                            WHEN '9pm_9am' THEN '9PM-9AM Silence'
                            WHEN 'program' THEN 'Program Silence'
                            ELSE 'Silence'
                        END AS name,
                    sp.start_date,
                    sp.end_date,
                    sp.status
                FROM sahyog_silence_period sp
                LEFT JOIN hr_employee e ON e.id = sp.volunteer_id
                WHERE sp.status NOT IN ('cancelled')
                UNION ALL
                SELECT
                    bp.id + 100000 AS id,
                    bp.volunteer_id,
                    'break' AS entry_type,
                    COALESCE(e.name, 'Unknown') || ' — ' ||
                        CASE bp.break_type
                            WHEN 'personal' THEN 'Personal Break'
                            WHEN 'health' THEN 'Health Break'
                            WHEN 'family_emergency' THEN 'Family Emergency'
                            ELSE 'Break'
                        END AS name,
                    bp.start_date,
                    bp.end_date,
                    bp.status
                FROM sahyog_break_period bp
                LEFT JOIN hr_employee e ON e.id = bp.volunteer_id
                WHERE bp.status NOT IN ('cancelled')
                UNION ALL
                SELECT
                    vp.id + 200000 AS id,
                    vp.volunteer_id,
                    'program' AS entry_type,
                    COALESCE(e.name, 'Unknown') || ' — ' || COALESCE(p.name, 'Program') AS name,
                    vp.start_date,
                    vp.end_date,
                    vp.completion_status AS status
                FROM sahyog_volunteer_program vp
                LEFT JOIN hr_employee e ON e.id = vp.volunteer_id
                LEFT JOIN sahyog_program p ON p.id = vp.program_id
                WHERE vp.completion_status NOT IN ('dropped')
            )
        """ % self._table)
