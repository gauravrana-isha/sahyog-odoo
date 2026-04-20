from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _


class ProgramSchedule(models.Model):
    _name = 'sahyog.program.schedule'
    _description = 'Program Schedule'
    _order = 'start_date desc'
    _rec_name = 'display_name'

    display_name = fields.Char(compute='_compute_display_name', store=False)
    program_id = fields.Many2one('sahyog.program', required=True, ondelete='cascade')
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)
    start_time = fields.Char()
    end_time = fields.Char()
    is_recurring = fields.Boolean(default=False)
    location = fields.Char()
    capacity = fields.Integer()
    fee = fields.Char()
    schedule_status = fields.Selection([
        ('planning', 'Planning'),
        ('upcoming', 'Upcoming'),
        ('completed', 'Completed'),
    ], required=True, default='planning')
    notes = fields.Text()

    @api.depends('program_id', 'start_date', 'end_date', 'location')
    def _compute_display_name(self):
        for rec in self:
            prog = rec.program_id.name or 'Schedule'
            loc = (' @ %s' % rec.location) if rec.location else ''
            rec.display_name = '%s (%s → %s%s)' % (prog, rec.start_date or '', rec.end_date or '', loc)

    @api.constrains('start_date', 'end_date')
    def _check_dates(self):
        for rec in self:
            if rec.end_date < rec.start_date:
                raise ValidationError(_('End date must be >= start date.'))

    def action_open_schedule_sheet(self):
        """Open the Google Sheets schedule spreadsheet in a new tab."""
        return {
            'type': 'ir.actions.act_url',
            'url': 'https://docs.google.com/spreadsheets/d/1lOk_LZ1BYDazrWh0ZZxmis3thv_dnbNI/edit',
            'target': 'new',
        }

    @api.constrains('start_time', 'end_time')
    def _check_times(self):
        import re
        time_re = re.compile(r'^\d{2}:\d{2}$')
        for rec in self:
            for t in (rec.start_time, rec.end_time):
                if t and not time_re.match(t):
                    raise ValidationError(_('Time must be in HH:MM format.'))
