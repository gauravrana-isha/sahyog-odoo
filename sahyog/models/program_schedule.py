from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _


class ProgramSchedule(models.Model):
    _name = 'sahyog.program.schedule'
    _description = 'Program Schedule'
    _order = 'start_date desc'

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

    @api.constrains('start_date', 'end_date')
    def _check_dates(self):
        for rec in self:
            if rec.end_date < rec.start_date:
                raise ValidationError(_('End date must be >= start date.'))

    @api.constrains('start_time', 'end_time')
    def _check_times(self):
        import re
        time_re = re.compile(r'^\d{2}:\d{2}$')
        for rec in self:
            for t in (rec.start_time, rec.end_time):
                if t and not time_re.match(t):
                    raise ValidationError(_('Time must be in HH:MM format.'))
