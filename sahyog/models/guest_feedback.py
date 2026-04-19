from odoo import api, fields, models


class GuestFeedback(models.Model):
    _name = 'sahyog.guest.feedback'
    _description = 'Guest Feedback'
    _order = 'create_date desc'
    _rec_name = 'guest_name'

    # ── Link to visit ──
    visit_id = fields.Many2one('sahyog.guest.visit', string='Guest Visit',
                               required=True, ondelete='cascade')
    region_id = fields.Many2one('sahyog.region', string='Region',
                                related='visit_id.region_id', store=True, readonly=True)

    # ── Guest details ──
    guest_name = fields.Char('Guest Name', required=True)
    contact_phone = fields.Char('Phone')
    contact_email = fields.Char('Email')

    # ── Feedback ──
    overall_rating = fields.Selection([
        ('1', '1 – Poor'),
        ('2', '2 – Fair'),
        ('3', '3 – Good'),
        ('4', '4 – Very Good'),
        ('5', '5 – Excellent'),
    ], string='Overall Rating', required=True)
    enjoyed_most = fields.Text('What did you enjoy most?')
    could_be_improved = fields.Text('What could be improved?')
    interested_in_programs = fields.Boolean('Interested in Programs', default=False)
    want_to_know_initiatives = fields.Boolean('Want to Know About Initiatives', default=False)
    would_visit_again = fields.Selection([
        ('yes', 'Yes'),
        ('no', 'No'),
        ('maybe', 'Maybe'),
    ], string='Would Visit Again')
    additional_comments = fields.Text('Additional Comments')
