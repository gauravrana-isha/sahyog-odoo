from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _


class Meeting(models.Model):
    _name = 'sahyog.meeting'
    _description = 'Meeting'
    _order = 'date desc, start_time desc'

    title = fields.Char(required=True)
    volunteer_id = fields.Many2one('hr.employee', required=True, string='Volunteer')
    meeting_with_id = fields.Many2one('hr.employee', required=True, string='Meeting With')
    date = fields.Date(required=True)
    start_time = fields.Char(required=True)
    end_time = fields.Char(required=True)
    location = fields.Char()
    notes = fields.Text()
    status = fields.Selection([
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ], required=True, default='scheduled')
    created_by = fields.Many2one('res.users', required=True, default=lambda self: self.env.uid)

    @api.constrains('volunteer_id', 'meeting_with_id')
    def _check_different_participants(self):
        for rec in self:
            if rec.volunteer_id == rec.meeting_with_id:
                raise ValidationError(_('A meeting must be between two different volunteers.'))

    @api.constrains('start_time', 'end_time')
    def _check_times(self):
        for rec in self:
            if rec.start_time and rec.end_time and rec.start_time >= rec.end_time:
                raise ValidationError(_('Start time must be before end time.'))

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        Notification = self.env['sahyog.notification']
        for rec in records:
            # Notify both participants
            Notification.create({
                'volunteer_id': rec.volunteer_id.id,
                'type': 'meeting_scheduled',
                'title': 'Meeting Scheduled: %s' % rec.title,
                'message': 'A meeting has been scheduled on %s from %s to %s with %s. [[action:/history?filter=meetings|meeting|%s]]' % (
                    rec.date, rec.start_time, rec.end_time,
                    rec.meeting_with_id.name, rec.id,
                ),
            })
            Notification.create({
                'volunteer_id': rec.meeting_with_id.id,
                'type': 'meeting_scheduled',
                'title': 'Meeting Scheduled: %s' % rec.title,
                'message': 'A meeting has been scheduled on %s from %s to %s with %s. [[action:/history?filter=meetings|meeting|%s]]' % (
                    rec.date, rec.start_time, rec.end_time,
                    rec.volunteer_id.name, rec.id,
                ),
            })
        return records
