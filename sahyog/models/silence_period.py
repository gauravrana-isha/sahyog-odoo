import logging

from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _

_logger = logging.getLogger(__name__)


class SilencePeriod(models.Model):
    _name = 'sahyog.silence.period'
    _description = 'Silence Period'
    _order = 'start_date desc'
    _rec_name = 'display_name'

    display_name = fields.Char(compute='_compute_display_name', store=False)
    volunteer_id = fields.Many2one('hr.employee', required=True, ondelete='cascade')
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)
    start_time = fields.Char()  # "HH:MM" format
    end_time = fields.Char()
    is_recurring = fields.Boolean(default=False)
    silence_type = fields.Selection([
        ('personal', 'Personal'),
        ('9pm_9am', '9PM-9AM Silence'),
        ('program', 'Program Silence'),
    ], string='Silence Type')
    program_id = fields.Many2one('sahyog.program')
    schedule_id = fields.Many2one('sahyog.program.schedule')
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

    @api.depends('volunteer_id', 'silence_type', 'start_date', 'end_date')
    def _compute_display_name(self):
        for rec in self:
            vol = rec.volunteer_id.name or 'Unknown'
            stype = dict(rec._fields['silence_type'].selection).get(rec.silence_type, '') if rec.silence_type else ''
            rec.display_name = '%s — %s (%s → %s)' % (vol, stype, rec.start_date or '', rec.end_date or '')

    def action_approve(self):
        self.write({'status': 'approved'})

    def action_cancel(self):
        self.write({'status': 'cancelled'})

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
                        'type': 'silence_approved',
                        'title': 'Silence Period Approved',
                        'message': 'Your silence period from %s to %s has been approved.' % (
                            rec.start_date, rec.end_date,
                        ),
                    })
                elif new_status == 'cancelled':
                    Notification.create({
                        'volunteer_id': rec.volunteer_id.id,
                        'type': 'silence_cancelled',
                        'title': 'Silence Period Cancelled',
                        'message': 'The silence period from %s to %s has been cancelled.' % (
                            rec.start_date, rec.end_date,
                        ),
                    })
                elif new_status == 'pending_admin':
                    self._notify_admins(
                        'silence_request_pending',
                        'New Silence Period Request',
                        'Volunteer %s has requested a silence period from %s to %s.' % (
                            rec.volunteer_id.name, rec.start_date, rec.end_date,
                        ),
                    )
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

    def _cron_daily_transitions(self):
        """Daily cron: transition statuses for silence, break, and program records.

        Processes all three model types in sequence:
        1. Silence periods: Approved→On Going, On Going→Done
        2. Break periods: Approved→On Going, On Going→Done
        3. Volunteer programs: Upcoming→Done
        Logs each transition to sahyog.cron.log and recomputes volunteer status.
        """
        today = fields.Date.context_today(self)
        CronLog = self.env['sahyog.cron.log']
        affected_volunteer_ids = set()

        # ── 1. Silence periods ──
        # Approved → On Going (today between start_date and end_date)
        silence_to_ongoing = self.search([
            ('status', '=', 'approved'),
            ('start_date', '<=', today),
            ('end_date', '>=', today),
        ])
        for rec in silence_to_ongoing:
            try:
                old_status = rec.status
                rec.write({'status': 'on_going'})
                CronLog.create({
                    'entry_type': 'silence',
                    'entry_id': rec.id,
                    'volunteer_name': rec.volunteer_id.name or '',
                    'old_status': old_status,
                    'new_status': 'on_going',
                })
                affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed transitioning silence.period %s to on_going", rec.id
                )

        # On Going → Done (today > end_date)
        silence_to_done = self.search([
            ('status', '=', 'on_going'),
            ('end_date', '<', today),
        ])
        for rec in silence_to_done:
            try:
                old_status = rec.status
                rec.write({'status': 'done'})
                CronLog.create({
                    'entry_type': 'silence',
                    'entry_id': rec.id,
                    'volunteer_name': rec.volunteer_id.name or '',
                    'old_status': old_status,
                    'new_status': 'done',
                })
                affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed transitioning silence.period %s to done", rec.id
                )

        # ── 2. Break periods ──
        BreakPeriod = self.env['sahyog.break.period']

        # Approved → On Going
        break_to_ongoing = BreakPeriod.search([
            ('status', '=', 'approved'),
            ('start_date', '<=', today),
            ('end_date', '>=', today),
        ])
        for rec in break_to_ongoing:
            try:
                old_status = rec.status
                rec.write({'status': 'on_going'})
                CronLog.create({
                    'entry_type': 'break',
                    'entry_id': rec.id,
                    'volunteer_name': rec.volunteer_id.name or '',
                    'old_status': old_status,
                    'new_status': 'on_going',
                })
                affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed transitioning break.period %s to on_going", rec.id
                )

        # On Going → Done
        break_to_done = BreakPeriod.search([
            ('status', '=', 'on_going'),
            ('end_date', '<', today),
        ])
        for rec in break_to_done:
            try:
                old_status = rec.status
                rec.write({'status': 'done'})
                CronLog.create({
                    'entry_type': 'break',
                    'entry_id': rec.id,
                    'volunteer_name': rec.volunteer_id.name or '',
                    'old_status': old_status,
                    'new_status': 'done',
                })
                affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed transitioning break.period %s to done", rec.id
                )

        # ── 3. Volunteer programs ──
        VolunteerProgram = self.env['sahyog.volunteer.program']

        # Upcoming → Done (today > end_date)
        programs_to_done = VolunteerProgram.search([
            ('completion_status', '=', 'upcoming'),
            ('end_date', '<', today),
        ])
        for rec in programs_to_done:
            try:
                old_status = rec.completion_status
                rec.write({'completion_status': 'done'})
                CronLog.create({
                    'entry_type': 'program',
                    'entry_id': rec.id,
                    'volunteer_name': rec.volunteer_id.name or '',
                    'old_status': old_status,
                    'new_status': 'done',
                })
                affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed transitioning volunteer.program %s to done", rec.id
                )

        # ── Recompute computed_status on affected volunteers ──
        if affected_volunteer_ids:
            try:
                volunteers = self.env['hr.employee'].browse(list(affected_volunteer_ids))
                volunteers._compute_status()
            except Exception:
                _logger.exception(
                    "Cron: failed recomputing computed_status for volunteers %s",
                    affected_volunteer_ids,
                )
