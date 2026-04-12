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
    disha_samskriti_batch = fields.Char('Disha/Samskriti Batch')
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

    @api.depends(
        'base_status',
        'silence_period_ids.status', 'silence_period_ids.start_date', 'silence_period_ids.end_date',
        'break_period_ids.status', 'break_period_ids.start_date', 'break_period_ids.end_date',
        'volunteer_program_ids.completion_status', 'volunteer_program_ids.start_date', 'volunteer_program_ids.end_date',
    )
    def _compute_status(self):
        """Availability engine: priority is Silence > Break > Program > base_status."""
        today = fields.Date.context_today(self)
        for rec in self:
            if rec.silence_period_ids.filtered(
                lambda s: s.status == 'on_going' or (
                    s.status == 'approved' and s.start_date <= today <= s.end_date
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
                lambda p: p.completion_status == 'upcoming' and p.start_date <= today <= p.end_date
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
