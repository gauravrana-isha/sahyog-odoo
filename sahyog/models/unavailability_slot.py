from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _


class UnavailabilitySlot(models.Model):
    _name = 'sahyog.unavailability.slot'
    _description = 'Unavailability Slot'
    _order = 'date, start_time'

    volunteer_id = fields.Many2one('hr.employee', required=True, ondelete='cascade')
    date = fields.Date(required=True)
    start_time = fields.Char(required=True)
    end_time = fields.Char(required=True)
    reason = fields.Text()

    @api.constrains('start_time', 'end_time')
    def _check_times(self):
        for rec in self:
            if rec.start_time >= rec.end_time:
                raise ValidationError(_('Start time must be before end time.'))
