from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _


class BreakPeriod(models.Model):
    _name = 'sahyog.break.period'
    _description = 'Break Period'
    _order = 'start_date desc'
    _rec_name = 'display_name'

    display_name = fields.Char(compute='_compute_display_name', store=False)
    volunteer_id = fields.Many2one('hr.employee', required=True, ondelete='cascade')
    break_type = fields.Selection([
        ('personal', 'Personal'),
        ('health', 'Health'),
        ('family_emergency', 'Family Emergency'),
    ], required=True)
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)
    start_time = fields.Char()
    end_time = fields.Char()
    is_recurring = fields.Boolean(default=False)
    program_id = fields.Many2one('sahyog.program')
    schedule_id = fields.Many2one('sahyog.program.schedule')
    reason = fields.Text()
    status = fields.Selection([
        ('requested', 'Requested'),
        ('approved', 'Approved'),
        ('on_going', 'On Going'),
        ('done', 'Done'),
        ('cancelled', 'Cancelled'),
        ('pending_admin', 'Pending Admin Approval'),
        ('pending_volunteer', 'Pending Volunteer Approval'),
    ], required=True, default='approved')
    notes = fields.Text()
    created_by = fields.Many2one('res.users', default=lambda self: self.env.uid)

    @api.depends('volunteer_id', 'break_type', 'start_date', 'end_date')
    def _compute_display_name(self):
        for rec in self:
            vol = rec.volunteer_id.name or 'Unknown'
            btype = dict(rec._fields['break_type'].selection).get(rec.break_type, '') if rec.break_type else ''
            rec.display_name = '%s — %s (%s → %s)' % (vol, btype, rec.start_date or '', rec.end_date or '')

    def action_approve(self):
        today = fields.Date.context_today(self)
        for rec in self:
            if rec.end_date < today:
                rec.write({'status': 'done'})
            elif rec.start_date <= today:
                rec.write({'status': 'on_going'})
            else:
                rec.write({'status': 'approved'})

    def action_cancel(self):
        self.write({'status': 'cancelled'})

    def action_request_volunteer(self):
        """Set status to pending_volunteer — volunteer must accept/reject from SPA."""
        self.write({'status': 'pending_volunteer'})

    @api.constrains('start_date', 'end_date')
    def _check_dates(self):
        for rec in self:
            if rec.end_date < rec.start_date:
                raise ValidationError(_('End date must be >= start date.'))

    def write(self, vals):
        res = super().write(vals)
        if 'status' in vals:
            Notification = self.env['sahyog.notification']
            new_status = vals['status']
            for rec in self:
                if new_status == 'approved':
                    Notification.create({
                        'volunteer_id': rec.volunteer_id.id,
                        'type': 'break_approved',
                        'title': 'Break Period Approved',
                        'message': 'Your break period from %s to %s has been approved. [[action:/history?filter=breaks|break|%s]]' % (
                            rec.start_date, rec.end_date, rec.id,
                        ),
                    })
                elif new_status == 'cancelled':
                    Notification.create({
                        'volunteer_id': rec.volunteer_id.id,
                        'type': 'break_cancelled',
                        'title': 'Break Period Cancelled',
                        'message': 'The break period from %s to %s has been cancelled. [[action:/history?filter=breaks|break|%s]]' % (
                            rec.start_date, rec.end_date, rec.id,
                        ),
                    })
                elif new_status == 'pending_admin':
                    self._notify_admins(
                        'break_request_pending',
                        'New Break Period Request',
                        'Volunteer %s has requested a break period from %s to %s. [[action:/history?filter=breaks|break|%s]]' % (
                            rec.volunteer_id.name, rec.start_date, rec.end_date, rec.id,
                        ),
                    )
                elif new_status == 'pending_volunteer':
                    Notification.create({
                        'volunteer_id': rec.volunteer_id.id,
                        'type': 'break_pending_volunteer',
                        'title': 'Break Period — Your Approval Needed',
                        'message': 'A break period from %s to %s needs your confirmation. [[action:/history?filter=breaks|break|%s]]' % (
                            rec.start_date, rec.end_date, rec.id,
                        ),
                    })
        return res

    def _notify_admins(self, notif_type, title, message):
        """Create a notification for each admin user's linked employee."""
        admin_group = self.env.ref('sahyog.group_sahyog_admin', raise_if_not_found=False)
        if not admin_group:
            return
        admin_users = self.env['res.users'].search([
            ('group_ids', 'in', admin_group.id),
        ])
        employees = self.env['hr.employee'].search([
            ('user_id', 'in', admin_users.ids),
        ])
        Notification = self.env['sahyog.notification']
        for emp in employees:
            Notification.create({
                'volunteer_id': emp.id,
                'type': notif_type,
                'title': title,
                'message': message,
            })
