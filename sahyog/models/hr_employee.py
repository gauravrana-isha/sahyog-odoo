from datetime import datetime, time as dt_time

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    # ── Volunteer classification ──
    volunteer_type_ids = fields.Many2many('sahyog.volunteer.type', string='Volunteer Types')
    work_mode = fields.Selection([
        ('office', 'Office'),
        ('remote', 'Remote'),
        ('guest_care', 'Guest Care'),
    ], string='Work Mode')

    # ── Dates ──
    date_of_joining_isha = fields.Date('Date of Joining Isha')
    date_of_joining_guest_care = fields.Date('Date of Joining Guest Care')

    # ── Role & assignment ──
    role_in_guest_care = fields.Char('Role in Guest Care')
    current_assignment_area = fields.Char('Current Assignment Area')
    reporting_to_name = fields.Char('Reporting To')  # Free text, not relational

    # ── Personal ──
    language_ids = fields.Many2many('sahyog.language', string='Languages Spoken')
    special_skills = fields.Text('Special Skills')
    x_city = fields.Char('City')
    x_state = fields.Char('State')
    x_nationality = fields.Char('Nationality')
    region_id = fields.Many2one('sahyog.region', string='Region')
    center_id = fields.Many2one('sahyog.center', string='Center')
    sadhana_practice_ids = fields.Many2many('sahyog.sadhana.practice', string='Sadhana Practices')
    health_conditions = fields.Text('Health Conditions')

    # ── Status ──
    base_status = fields.Selection([
        ('available', 'Available'),
        ('break', 'Break'),
        ('away', 'Away'),
        ('left', 'Left'),
    ], string='Base Status', default='available', required=True)
    computed_status = fields.Char('Current Status', compute='_compute_status', store=True)

    # ── Organization ──
    sub_team_id = fields.Many2one('sahyog.sub.team', string='Sub Team')
    notes = fields.Text('Notes')
    added_by = fields.Char('Added By')

    # ── Emergency contact ──
    emergency_contact_name = fields.Char('Emergency Contact Name')
    emergency_contact_phone = fields.Char('Emergency Contact Phone')
    emergency_contact_relation = fields.Char('Emergency Contact Relation')
    whatsapp_number = fields.Char('WhatsApp Number')

    # ── Reverse relations (for depends) ──
    silence_period_ids = fields.One2many('sahyog.silence.period', 'volunteer_id')
    break_period_ids = fields.One2many('sahyog.break.period', 'volunteer_id')
    volunteer_program_ids = fields.One2many('sahyog.volunteer.program', 'volunteer_id')

    # ── Summary fields for list view ──
    silence_summary = fields.Html('Silence', compute='_compute_entry_summaries', store=True, sanitize=False)
    break_summary = fields.Html('Break', compute='_compute_entry_summaries', store=True, sanitize=False)
    program_summary = fields.Html('Programs', compute='_compute_entry_summaries', store=True, sanitize=False)

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
        start = dt_time(int(parts_s[0]), int(parts_s[1]))
        end = dt_time(int(parts_e[0]), int(parts_e[1]))
        if start <= end:
            return start <= now_time <= end
        else:
            # cross-midnight
            return now_time >= start or now_time <= end

    @staticmethod
    def _fmt_date_compact(d, today):
        """Format a date compactly: 'Apr 5' if same year, 'Dec'25 5' if different."""
        if not d:
            return ''
        if d.year != today.year:
            return "%s'%s %d" % (d.strftime('%b'), str(d.year)[-2:], d.day)
        return '%s %d' % (d.strftime('%b'), d.day)

    @staticmethod
    def _fmt_range_compact(start, end, today):
        """Format a date range compactly."""
        if not start or not end:
            return ''
        s = HrEmployee._fmt_date_compact(start, today)
        if start.month == end.month and start.year == end.year:
            return '%s–%d' % (s, end.day)
        e = HrEmployee._fmt_date_compact(end, today)
        return '%s – %s' % (s, e)

    @api.depends(
        'silence_period_ids.status', 'silence_period_ids.start_date', 'silence_period_ids.end_date',
        'break_period_ids.status', 'break_period_ids.start_date', 'break_period_ids.end_date',
        'volunteer_program_ids.completion_status', 'volunteer_program_ids.start_date', 'volunteer_program_ids.end_date',
    )
    def _compute_entry_summaries(self):
        today = fields.Date.context_today(self)
        ACTIVE = ('approved', 'on_going')

        def pill(text, color):
            """Return an HTML pill/badge span."""
            colors = {
                'grey': ('background:#e9ecef;color:#495057;', ''),
                'blue': ('background:#d0ebff;color:#1971c2;', ''),
                'green': ('background:#d3f9d8;color:#2b8a3e;', ''),
            }
            style = colors.get(color, colors['grey'])[0]
            return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;margin:1px 2px;white-space:nowrap;%s">%s</span>' % (style, text)

        for rec in self:
            # ── Silence ──
            last_silence = rec.silence_period_ids.filtered(
                lambda s: s.status == 'done'
            ).sorted('end_date', reverse=True)[:1]
            current_silence = rec.silence_period_ids.filtered(
                lambda s: s.status in ACTIVE and s.start_date <= today <= s.end_date
            ).sorted('start_date')[:1]
            next_silence = rec.silence_period_ids.filtered(
                lambda s: s.status in ACTIVE and s.start_date > today
            ).sorted('start_date')[:1] if not current_silence else rec.silence_period_ids.browse()
            parts = []
            if last_silence:
                parts.append(pill('%s ✓' % self._fmt_range_compact(last_silence.start_date, last_silence.end_date, today), 'grey'))
            active_s = current_silence or next_silence
            if active_s:
                color = 'blue' if current_silence else 'green'
                symbol = '●' if current_silence else '→'
                parts.append(pill('%s %s' % (self._fmt_range_compact(active_s.start_date, active_s.end_date, today), symbol), color))
            rec.silence_summary = ' '.join(parts) if parts else '<span style="color:#adb5bd">–</span>'

            # ── Break ──
            last_break = rec.break_period_ids.filtered(
                lambda b: b.status == 'done'
            ).sorted('end_date', reverse=True)[:1]
            current_break = rec.break_period_ids.filtered(
                lambda b: b.status in ACTIVE and b.start_date <= today <= b.end_date
            ).sorted('start_date')[:1]
            next_break = rec.break_period_ids.filtered(
                lambda b: b.status in ACTIVE and b.start_date > today
            ).sorted('start_date')[:1] if not current_break else rec.break_period_ids.browse()
            parts = []
            if last_break:
                parts.append(pill('%s ✓' % self._fmt_range_compact(last_break.start_date, last_break.end_date, today), 'grey'))
            active_b = current_break or next_break
            if active_b:
                color = 'blue' if current_break else 'green'
                symbol = '●' if current_break else '→'
                parts.append(pill('%s %s' % (self._fmt_range_compact(active_b.start_date, active_b.end_date, today), symbol), color))
            rec.break_summary = ' '.join(parts) if parts else '<span style="color:#adb5bd">–</span>'

            # ── Programs ──
            last_prog = rec.volunteer_program_ids.filtered(
                lambda p: p.completion_status == 'done'
            ).sorted('end_date', reverse=True)[:1]
            current_prog = rec.volunteer_program_ids.filtered(
                lambda p: p.completion_status in ('upcoming', 'on_going') and p.start_date <= today <= p.end_date
            ).sorted('start_date')[:1]
            next_prog = rec.volunteer_program_ids.filtered(
                lambda p: p.completion_status in ('upcoming', 'on_going') and p.start_date > today
            ).sorted('start_date')[:1] if not current_prog else rec.volunteer_program_ids.browse()
            parts = []
            if last_prog:
                name = last_prog.program_id.name or ''
                short = name[:15] + '…' if len(name) > 15 else name
                parts.append(pill('%s ✓' % short, 'grey'))
            active_p = current_prog or next_prog
            if active_p:
                name = active_p.program_id.name or ''
                short = name[:15] + '…' if len(name) > 15 else name
                color = 'blue' if current_prog else 'green'
                symbol = '●' if current_prog else '→'
                parts.append(pill('%s %s' % (short, symbol), color))
            rec.program_summary = ' '.join(parts) if parts else '<span style="color:#adb5bd">–</span>'

    @api.depends(
        'base_status',
        'silence_period_ids.status', 'silence_period_ids.start_date', 'silence_period_ids.end_date',
        'silence_period_ids.is_recurring', 'silence_period_ids.start_time', 'silence_period_ids.end_time',
        'break_period_ids.status', 'break_period_ids.start_date', 'break_period_ids.end_date',
        'volunteer_program_ids.completion_status', 'volunteer_program_ids.start_date', 'volunteer_program_ids.end_date',
    )
    def _compute_status(self):
        """Availability engine: priority is Silence > Break > Program > base_status."""
        today = fields.Date.context_today(self)
        now_time = datetime.now().time()
        for rec in self:
            if rec.silence_period_ids.filtered(
                lambda s: s.status == 'on_going' or (
                    s.status == 'approved' and s.start_date <= today <= s.end_date
                    and (not s.is_recurring or rec._is_in_time_window(s, now_time))
                )
            ):
                rec.computed_status = 'On Silence'
            elif rec.break_period_ids.filtered(
                lambda b: b.status == 'on_going' or (
                    b.status == 'approved' and b.start_date <= today <= b.end_date
                )
            ):
                rec.computed_status = 'On Break'
            elif rec.volunteer_program_ids.filtered(
                lambda p: p.completion_status in ('upcoming', 'on_going') and p.start_date <= today <= p.end_date
            ):
                rec.computed_status = 'On Program'
            else:
                rec.computed_status = dict(rec._fields['base_status'].selection).get(
                    rec.base_status, 'Available'
                )

    @api.constrains('work_email')
    def _check_unique_email(self):
        for rec in self:
            if rec.work_email:
                duplicate = self.search([
                    ('work_email', '=', rec.work_email),
                    ('id', '!=', rec.id),
                ], limit=1)
                if duplicate:
                    raise ValidationError(_('Email must be unique across volunteers.'))

    @api.constrains('name')
    def _check_name_required(self):
        for rec in self:
            if not rec.name or not rec.name.strip():
                raise ValidationError(_('Full name is required.'))
