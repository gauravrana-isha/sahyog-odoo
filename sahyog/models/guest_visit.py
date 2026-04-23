import secrets
from datetime import datetime, timedelta

from odoo import api, fields, models
from odoo.exceptions import ValidationError


GUEST_REGIONS = [
    ('uk_europe', 'UK, Europe'),
    ('eastern_europe', 'Eastern Europe'),
    ('middle_east', 'Middle East'),
    ('africa', 'Africa'),
    ('apac', 'APAC'),
    ('india_up_delhi', 'India - UP & Delhi'),
    ('india_north', 'India - North'),
    ('india_east', 'India - East'),
    ('india_west', 'India - West'),
    ('india_ka', 'India - KA'),
    ('india_apt', 'India - APT'),
    ('india_tnk', 'India - TNK'),
    ('nepal', 'Nepal'),
    ('us', 'US'),
]

COMPANY_SECTORS = [
    ('entertainment_art_culture', 'Entertainment, Art and Culture'),
    ('government_bureaucrats', 'Government, Bureaucrats & Intergovernmental Organization'),
    ('corporate_business', 'Corporate / Business'),
    ('education_academia', 'Education / Academia'),
    ('healthcare_medical', 'Healthcare / Medical'),
    ('legal', 'Legal'),
    ('media_journalism', 'Media / Journalism'),
    ('ngo_nonprofit', 'NGO / Non-Profit'),
    ('sports', 'Sports'),
    ('technology', 'Technology'),
    ('religious_spiritual', 'Religious / Spiritual Leaders'),
    ('diplomats', 'Diplomats / Ambassadors'),
    ('other', 'Other'),
]

ACCOMMODATION_TYPES = [
    ('nalanda_presidential', 'Nalanda Presidential Suite'),
    ('nalanda_suite', 'Nalanda Suite'),
    ('nalanda_room', 'Nalanda Room'),
    ('ananda_suite', 'Ananda Suite'),
    ('ananda_room', 'Ananda Room'),
    ('guest_house', 'Guest House'),
    ('cottage', 'Cottage'),
    ('day_visit', 'Day Visit'),
    ('other', 'Other'),
]


class GuestVisit(models.Model):
    _name = 'sahyog.guest.visit'
    _description = 'Guest Visit'
    _order = 'create_date desc'
    _rec_name = 'main_guest_name'

    _constraints = [
        models.Constraint(
            'unique(qr_token)',
            'QR token must be unique.',
        ),
    ]

    # ── Volunteer / origin ──
    volunteer_id = fields.Many2one('hr.employee', string='Volunteer',
                                   required=True, ondelete='cascade')
    region_id = fields.Many2one('sahyog.region', string='Region',
                                related='volunteer_id.region_id', store=True, readonly=True)
    center_id = fields.Many2one('sahyog.center', string='Center',
                                related='volunteer_id.center_id', store=True, readonly=True)

    # ── Guest details ──
    main_guest_name = fields.Char('Main Guest Name', required=True)
    gender = fields.Selection([
        ('male', 'Male'),
        ('female', 'Female'),
        ('group', 'Group'),
    ], string='Gender')
    designation_company = fields.Char('Designation and Company')
    company_sector = fields.Selection(COMPANY_SECTORS, string='Company Sector')
    phone = fields.Char('Phone')
    email = fields.Char('Email')
    address = fields.Text('Address')
    guest_region = fields.Selection(GUEST_REGIONS, string='Guest Region')

    # ── Visit details ──
    arrival_date = fields.Date('Arrival Date')
    departure_date = fields.Date('Departure Date')
    accommodation_type = fields.Selection(ACCOMMODATION_TYPES, string='Accommodation Type')
    reference_of = fields.Char('Reference Of')
    poc_name = fields.Char('POC Name')
    poc_contact = fields.Char('POC Contact')
    place_event_ids = fields.Many2many('sahyog.guest.place', string='Places / Events Attended')
    places_other = fields.Char('Places / Events - Other')
    accompanying_guest_count = fields.Integer('Accompanying Guest Count', default=0)

    # ── Experience ──
    experience_rating = fields.Selection([
        ('1', '1 – Poor'),
        ('2', '2 – Fair'),
        ('3', '3 – Good'),
        ('4', '4 – Very Good'),
        ('5', '5 – Excellent'),
    ], string='Experience Rating')
    experience_details = fields.Text('Experience Details')
    action_required = fields.Text('Action Required')
    compliments_offered = fields.Text('Compliments Offered')
    other_remarks = fields.Text('Other Remarks')

    # ── Auto-filled ──
    submitter_email = fields.Char('Submitter Email')

    # ── QR / feedback ──
    qr_token = fields.Char('QR Token', index=True, copy=False)
    feedback_link = fields.Char('Feedback Link', compute='_compute_feedback_link', store=True)
    qr_expiry = fields.Datetime('QR Expiry', compute='_compute_qr_expiry', store=True)

    # ── State ──
    state = fields.Selection([
        ('draft', 'Draft'),
        ('complete', 'Complete'),
    ], string='Status', default='draft', required=True)

    # ── Google Form sync ──
    google_form_synced = fields.Boolean('Google Form Synced', default=False)
    google_form_error = fields.Text('Google Form Error')
    google_sheet_uid = fields.Char('Google Sheet UID', copy=False)

    # ── Feedback ──
    feedback_ids = fields.One2many('sahyog.guest.feedback', 'visit_id', string='Feedback')
    feedback_count = fields.Integer('Feedback Count', compute='_compute_feedback_count', store=True)

    # ── Computed fields ──

    @api.depends('qr_token')
    def _compute_feedback_link(self):
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url', '')
        for rec in self:
            if rec.qr_token:
                rec.feedback_link = '%s/sahyog/guest-feedback/%s' % (base_url, rec.qr_token)
            else:
                rec.feedback_link = False

    @api.depends('departure_date')
    def _compute_qr_expiry(self):
        for rec in self:
            if rec.departure_date:
                # departure_date at 23:59:59 + 48 hours
                eod = datetime.combine(rec.departure_date, datetime.max.time())
                rec.qr_expiry = eod + timedelta(hours=48)
            else:
                rec.qr_expiry = False

    @api.depends('feedback_ids')
    def _compute_feedback_count(self):
        for rec in self:
            rec.feedback_count = len(rec.feedback_ids)

    # ── Constraints ──

    @api.constrains('arrival_date', 'departure_date')
    def _check_dates(self):
        for rec in self:
            if rec.arrival_date and rec.departure_date and rec.departure_date < rec.arrival_date:
                raise ValidationError('Departure date must be on or after arrival date.')

    # ── Create override ──

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            # Auto-generate QR token
            if not vals.get('qr_token'):
                vals['qr_token'] = secrets.token_urlsafe(32)
            # Auto-populate from current user's employee
            if not vals.get('volunteer_id'):
                employee = self.env.user.employee_id
                if employee:
                    vals['volunteer_id'] = employee.id
            if not vals.get('submitter_email'):
                employee = self.env['hr.employee'].browse(
                    vals.get('volunteer_id')
                ) if vals.get('volunteer_id') else self.env.user.employee_id
                if employee:
                    vals['submitter_email'] = employee.work_email
        return super().create(vals_list)

    # ── Google Sheets sync ──

    def _trigger_google_sheets_sync(self):
        """Synchronous Google Sheets sync. Updates status on the same record."""
        from odoo.addons.sahyog.utils.google_sheets import submit_to_google_sheets
        self.ensure_one()
        success, result = submit_to_google_sheets(self)
        if success:
            self.write({
                'google_form_synced': True,
                'google_form_error': False,
                'google_sheet_uid': result,  # result is the UID on success
            })
        else:
            self.write({
                'google_form_synced': False,
                'google_form_error': result,  # result is the error message on failure
            })

