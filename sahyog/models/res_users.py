import logging

from odoo import api, models
from odoo.exceptions import AccessDenied

_logger = logging.getLogger(__name__)


class ResUsers(models.Model):
    _inherit = 'res.users'

    @api.model_create_multi
    def create(self, vals_list):
        users = super().create(vals_list)
        volunteer_group = self.env.ref('sahyog.group_sahyog_volunteer', raise_if_not_found=False)
        if volunteer_group:
            for user in users:
                if not user.share and volunteer_group not in user.group_ids:
                    user.write({'group_ids': [(4, volunteer_group.id)]})
        return users

    @api.model
    def _auth_oauth_signin(self, provider, validation, params):
        """Override to match by email if oauth_uid lookup fails.

        Default Odoo behavior: look up user by (oauth_uid, oauth_provider_id).
        If not found, it tries to CREATE a new user which fails if login exists.

        Our override: if oauth_uid lookup fails, try matching by email.
        If found, link the Google sub ID to the existing user and proceed.
        """
        try:
            return super()._auth_oauth_signin(provider, validation, params)
        except AccessDenied:
            # oauth_uid not found — try matching by email
            oauth_uid = validation.get('user_id') or validation.get('sub')
            email = validation.get('email')
            if not email:
                raise

            user = self.search([('login', '=', email), ('active', '=', True)], limit=1)
            if not user:
                # No user with this email — re-raise (don't auto-create)
                raise

            # Link the Google sub ID to the existing user
            user.write({
                'oauth_provider_id': provider,
                'oauth_uid': oauth_uid,
                'oauth_access_token': params.get('access_token'),
            })
            _logger.info('OAuth: linked Google sub %s to existing user %s (id=%d)',
                         oauth_uid, email, user.id)
            return user.login
