from odoo import api, fields, models


class VolunteerProgram(models.Model):
    _name = 'sahyog.volunteer.program'
    _description = 'Volunteer Program Enrollment'
    _order = 'start_date desc'
    _rec_name = 'display_name'

    display_name = fields.Char(compute='_compute_display_name', store=False)
    volunteer_id = fields.Many2one('hr.employee', required=True, ondelete='cascade')
    program_id = fields.Many2one('sahyog.program', required=True)
    schedule_id = fields.Many2one('sahyog.program.schedule')
    participation_type = fields.Selection([
        ('participant', 'Participant'),
        ('volunteer', 'Volunteer'),
    ], required=True)
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)
    location = fields.Char()
    completion_status = fields.Selection([
        ('done', 'Done'),
        ('upcoming', 'Upcoming'),
        ('on_going', 'On Going'),
        ('dropped', 'Dropped'),
        ('pending_volunteer', 'Pending Volunteer Approval'),
        ('pending_admin', 'Pending Admin Approval'),
    ], required=True, default='upcoming')
    notes = fields.Text()
    created_by = fields.Many2one('res.users', default=lambda self: self.env.uid)

    @api.depends('volunteer_id', 'program_id', 'start_date', 'end_date')
    def _compute_display_name(self):
        for rec in self:
            vol = rec.volunteer_id.name or 'Unknown'
            prog = rec.program_id.name or ''
            rec.display_name = '%s — %s (%s → %s)' % (vol, prog, rec.start_date or '', rec.end_date or '')

    def action_approve(self):
        self.write({'completion_status': 'upcoming'})

    def action_reject(self):
        self.write({'completion_status': 'dropped'})

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        Notification = self.env['sahyog.notification']
        for rec in records:
            if rec.completion_status == 'pending_admin':
                # Volunteer requested enrollment — notify admins
                self._notify_admins(
                    'program_request_pending',
                    'New Program Enrollment Request',
                    'Volunteer %s has requested enrollment in %s from %s to %s. [[action:/history?filter=programs|program|%s]]' % (
                        rec.volunteer_id.name, rec.program_id.name,
                        rec.start_date, rec.end_date, rec.id,
                    ),
                )
            else:
                # Admin enrolled volunteer — notify volunteer
                Notification.create({
                    'volunteer_id': rec.volunteer_id.id,
                    'type': 'program_enrolled',
                    'title': 'Enrolled in Program',
                    'message': 'You have been enrolled in %s from %s to %s. [[action:/history?filter=programs|program|%s]]' % (
                        rec.program_id.name, rec.start_date, rec.end_date, rec.id,
                    ),
                })
        return records

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
