import logging
from datetime import datetime, time

from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _
from . import silence_rules

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

    @api.constrains('is_recurring', 'start_time', 'end_time')
    def _check_recurring_times(self):
        import re
        time_re = re.compile(r'^\d{2}:\d{2}$')
        for rec in self:
            if rec.is_recurring:
                if not rec.start_time or not rec.end_time:
                    raise ValidationError(_('Start time and end time are required for recurring silence.'))
            for t in (rec.start_time, rec.end_time):
                if t and not time_re.match(t):
                    raise ValidationError(_('Time must be in HH:MM format.'))

    @api.onchange('silence_type')
    def _onchange_silence_type(self):
        if self.silence_type == '9pm_9am':
            self.is_recurring = True
            self.start_time = '21:00'
            self.end_time = '09:00'

    @api.model_create_multi
    def create(self, vals_list):
        """Auto-determine status based on dates."""
        today = fields.Date.context_today(self)
        for vals in vals_list:
            status = vals.get('status')
            end_date = fields.Date.from_string(vals.get('end_date')) if vals.get('end_date') else None
            start_date = fields.Date.from_string(vals.get('start_date')) if vals.get('start_date') else None
            if status == 'pending_admin' and end_date and end_date < today:
                vals['status'] = 'done'
            elif status == 'pending_volunteer' and start_date and start_date <= today:
                vals['status'] = 'approved'
        return super().create(vals_list)

    @api.constrains('start_date', 'end_date', 'volunteer_id')
    def _check_no_overlap(self):
        NON_CANCELLED = ('requested', 'approved', 'on_going', 'pending_admin', 'pending_volunteer')
        for rec in self:
            # Check against silence periods (exclude self)
            overlapping_silence = self.env['sahyog.silence.period'].search([
                ('volunteer_id', '=', rec.volunteer_id.id),
                ('id', '!=', rec.id),
                ('status', 'in', NON_CANCELLED),
                ('start_date', '<=', rec.end_date),
                ('end_date', '>=', rec.start_date),
            ], limit=1)
            if overlapping_silence:
                raise ValidationError(
                    _('Overlaps with existing silence period: %s → %s') %
                    (overlapping_silence.start_date, overlapping_silence.end_date)
                )
            # Check against break periods (different model, use id != 0)
            overlapping_break = self.env['sahyog.break.period'].search([
                ('volunteer_id', '=', rec.volunteer_id.id),
                ('id', '!=', 0),
                ('status', 'in', NON_CANCELLED),
                ('start_date', '<=', rec.end_date),
                ('end_date', '>=', rec.start_date),
            ], limit=1)
            if overlapping_break:
                raise ValidationError(
                    _('Overlaps with existing break period: %s → %s') %
                    (overlapping_break.start_date, overlapping_break.end_date)
                )

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
                        'message': 'Your silence period from %s to %s has been approved. [[action:/history?filter=silence|silence|%s]]' % (
                            rec.start_date, rec.end_date, rec.id,
                        ),
                    })
                elif new_status == 'cancelled':
                    Notification.create({
                        'volunteer_id': rec.volunteer_id.id,
                        'type': 'silence_cancelled',
                        'title': 'Silence Period Cancelled',
                        'message': 'The silence period from %s to %s has been cancelled. [[action:/history?filter=silence|silence|%s]]' % (
                            rec.start_date, rec.end_date, rec.id,
                        ),
                    })
                elif new_status == 'pending_admin':
                    self._notify_admins(
                        'silence_request_pending',
                        'New Silence Period Request',
                        'Volunteer %s has requested a silence period from %s to %s. [[action:/history?filter=silence|silence|%s]]' % (
                            rec.volunteer_id.name, rec.start_date, rec.end_date, rec.id,
                        ),
                    )
                elif new_status == 'pending_volunteer':
                    Notification.create({
                        'volunteer_id': rec.volunteer_id.id,
                        'type': 'silence_pending_volunteer',
                        'title': 'Silence Period — Your Approval Needed',
                        'message': 'A silence period from %s to %s needs your confirmation. [[action:/history?filter=silence|silence|%s]]' % (
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

    def _is_in_time_window(self, entry, now_time):
        """Check if *now_time* falls within entry's start_time..end_time.

        Returns True when:
        - entry has no start_time or end_time (always active)
        - same-day window (start <= end): start <= now_time <= end
        - cross-midnight window (start > end, e.g. 21:00→09:00): now_time >= start OR now_time <= end
        """
        if not entry.start_time or not entry.end_time:
            return True
        parts_s = entry.start_time.split(':')
        parts_e = entry.end_time.split(':')
        start = time(int(parts_s[0]), int(parts_s[1]))
        end = time(int(parts_e[0]), int(parts_e[1]))
        if start <= end:
            return start <= now_time <= end
        else:
            # cross-midnight
            return now_time >= start or now_time <= end

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

        # ── 1. Silence periods (non-recurring only) ──
        # Approved → On Going (today between start_date and end_date)
        silence_to_ongoing = self.search([
            ('status', '=', 'approved'),
            ('start_date', '<=', today),
            ('end_date', '>=', today),
            ('is_recurring', '=', False),
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

        # On Going → Done (today > end_date, non-recurring only)
        silence_to_done = self.search([
            ('status', '=', 'on_going'),
            ('end_date', '<', today),
            ('is_recurring', '=', False),
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

        # Upcoming → On Going (today between start_date and end_date)
        programs_to_ongoing = VolunteerProgram.search([
            ('completion_status', '=', 'upcoming'),
            ('start_date', '<=', today),
            ('end_date', '>=', today),
        ])
        for rec in programs_to_ongoing:
            try:
                old_status = rec.completion_status
                rec.write({'completion_status': 'on_going'})
                CronLog.create({
                    'entry_type': 'program',
                    'entry_id': rec.id,
                    'volunteer_name': rec.volunteer_id.name or '',
                    'old_status': old_status,
                    'new_status': 'on_going',
                })
                affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed transitioning volunteer.program %s to on_going", rec.id
                )

        # On Going → Done (today > end_date)
        programs_to_done = VolunteerProgram.search([
            ('completion_status', 'in', ('upcoming', 'on_going')),
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

        # ── 4. Recurring silence periods (time-window logic) ──
        now_time = datetime.now().time()

        # Recurring entries within date range that are approved → check if in window → on_going
        recurring_approved = self.search([
            ('is_recurring', '=', True),
            ('status', '=', 'approved'),
            ('start_date', '<=', today),
            ('end_date', '>=', today),
        ])
        for rec in recurring_approved:
            try:
                if self._is_in_time_window(rec, now_time):
                    rec.write({'status': 'on_going'})
                    CronLog.create({
                        'entry_type': 'silence',
                        'entry_id': rec.id,
                        'volunteer_name': rec.volunteer_id.name or '',
                        'old_status': 'approved',
                        'new_status': 'on_going',
                    })
                    affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed transitioning recurring silence.period %s to on_going", rec.id
                )

        # Recurring entries that are on_going but outside window → back to approved
        recurring_ongoing = self.search([
            ('is_recurring', '=', True),
            ('status', '=', 'on_going'),
            ('start_date', '<=', today),
            ('end_date', '>=', today),
        ])
        for rec in recurring_ongoing:
            try:
                if not self._is_in_time_window(rec, now_time):
                    rec.write({'status': 'approved'})
                    CronLog.create({
                        'entry_type': 'silence',
                        'entry_id': rec.id,
                        'volunteer_name': rec.volunteer_id.name or '',
                        'old_status': 'on_going',
                        'new_status': 'approved',
                    })
                    affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed transitioning recurring silence.period %s back to approved", rec.id
                )

        # Recurring entries whose end_date has passed → done regardless of time window
        recurring_expired = self.search([
            ('is_recurring', '=', True),
            ('status', 'in', ('approved', 'on_going')),
            ('end_date', '<', today),
        ])
        for rec in recurring_expired:
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
                    "Cron: failed transitioning recurring silence.period %s to done", rec.id
                )

        # ── 5. Expired pending auto-cancellation ──
        Notification = self.env['sahyog.notification']
        PENDING_STATUSES = ('pending_admin', 'pending_volunteer')

        # Silence periods: pending + expired → cancelled
        expired_silence = self.search([
            ('status', 'in', PENDING_STATUSES),
            ('end_date', '<', today),
        ])
        for rec in expired_silence:
            try:
                old_status = rec.status
                rec.write({'status': 'cancelled'})
                CronLog.create({
                    'entry_type': 'silence',
                    'entry_id': rec.id,
                    'volunteer_name': rec.volunteer_id.name or '',
                    'old_status': old_status,
                    'new_status': 'cancelled',
                })
                Notification.create({
                    'volunteer_id': rec.volunteer_id.id,
                    'type': 'silence_expired',
                    'title': 'Silence Request Expired',
                    'message': 'Your silence period request from %s to %s expired without approval. [[action:/history?filter=silence|silence|%s]]' % (
                        rec.start_date, rec.end_date, rec.id,
                    ),
                })
                affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed auto-cancelling expired silence.period %s", rec.id
                )

        # Break periods: pending + expired → cancelled
        expired_breaks = BreakPeriod.search([
            ('status', 'in', PENDING_STATUSES),
            ('end_date', '<', today),
        ])
        for rec in expired_breaks:
            try:
                old_status = rec.status
                rec.write({'status': 'cancelled'})
                CronLog.create({
                    'entry_type': 'break',
                    'entry_id': rec.id,
                    'volunteer_name': rec.volunteer_id.name or '',
                    'old_status': old_status,
                    'new_status': 'cancelled',
                })
                Notification.create({
                    'volunteer_id': rec.volunteer_id.id,
                    'type': 'break_expired',
                    'title': 'Break Request Expired',
                    'message': 'Your break period request from %s to %s expired without approval. [[action:/history?filter=breaks|break|%s]]' % (
                        rec.start_date, rec.end_date, rec.id,
                    ),
                })
                affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed auto-cancelling expired break.period %s", rec.id
                )

        # Volunteer programs: pending + expired → dropped
        expired_programs = VolunteerProgram.search([
            ('completion_status', 'in', PENDING_STATUSES),
            ('end_date', '<', today),
        ])
        for rec in expired_programs:
            try:
                old_status = rec.completion_status
                rec.write({'completion_status': 'dropped'})
                CronLog.create({
                    'entry_type': 'program',
                    'entry_id': rec.id,
                    'volunteer_name': rec.volunteer_id.name or '',
                    'old_status': old_status,
                    'new_status': 'dropped',
                })
                Notification.create({
                    'volunteer_id': rec.volunteer_id.id,
                    'type': 'program_expired',
                    'title': 'Program Enrollment Request Expired',
                    'message': 'Your enrollment request for %s from %s to %s expired without approval. [[action:/history?filter=programs|program|%s]]' % (
                        rec.program_id.name, rec.start_date, rec.end_date, rec.id,
                    ),
                })
                affected_volunteer_ids.add(rec.volunteer_id.id)
            except Exception:
                _logger.exception(
                    "Cron: failed auto-dropping expired volunteer.program %s", rec.id
                )

        # ── 6. Cadence alert evaluation ──
        try:
            from dateutil.relativedelta import relativedelta
            current_year = today.year
            three_months_ago = today - relativedelta(months=3)

            # Find all volunteers that have a type with min_days > 0
            all_volunteers = self.env['hr.employee'].search([
                ('volunteer_type_ids', '!=', False),
            ])
            for volunteer in all_volunteers:
                min_days, _max_days = silence_rules.get_volunteer_limits(volunteer)
                if min_days <= 0:
                    # LTV or no minimum — skip
                    continue

                annual_total = silence_rules.calculate_annual_silence_days(
                    self.env, volunteer.id, current_year,
                )
                if annual_total >= min_days:
                    continue

                # Check if last silence ended 3+ months ago (or never had one)
                last_silence = self.search([
                    ('volunteer_id', '=', volunteer.id),
                    ('status', 'in', ('done', 'on_going', 'approved')),
                ], order='end_date desc', limit=1)

                if last_silence and last_silence.end_date > three_months_ago:
                    # Last silence ended less than 3 months ago — skip
                    continue

                # Both conditions met: below minimum AND 3+ months since last silence
                self._notify_admins(
                    'cadence_alert',
                    'Silence Cadence Alert',
                    'Volunteer %s has only %d silence days this year (minimum %d) '
                    'and has not taken silence in 3+ months.' % (
                        volunteer.name, annual_total, min_days,
                    ),
                )
        except Exception:
            _logger.exception("Cron: failed evaluating cadence alerts")

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
