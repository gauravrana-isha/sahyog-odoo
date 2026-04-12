import uuid

from odoo import api, fields, models


class RegistrationLink(models.Model):
    _name = 'sahyog.registration.link'
    _description = 'Registration Link'
    _order = 'create_date desc'
    _sql_constraints = [('token_unique', 'unique(token)', 'Token must be unique.')]

    token = fields.Char(required=True, default=lambda self: str(uuid.uuid4()))
    status = fields.Selection([
        ('active', 'Active'),
        ('used', 'Used'),
        ('expired', 'Expired'),
    ], required=True, default='active')
    expires_at = fields.Datetime(required=True)
    created_by = fields.Many2one('res.users', required=True, default=lambda self: self.env.uid)
    used_by_volunteer_id = fields.Many2one('hr.employee')
    registration_url = fields.Char(
        string='Registration URL', compute='_compute_registration_url',
        store=False,
    )

    @api.depends('token')
    def _compute_registration_url(self):
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url', '')
        for rec in self:
            rec.registration_url = f"{base_url}/sahyog/register/{rec.token}" if rec.token else ''

    def _check_and_expire(self):
        """Called before use to auto-expire if past expiration."""
        if self.status == 'active' and fields.Datetime.now() > self.expires_at:
            self.write({'status': 'expired'})
