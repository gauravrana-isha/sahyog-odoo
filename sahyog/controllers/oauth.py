import json
import logging

from odoo import http
from odoo.http import request
from odoo.addons.auth_oauth.controllers.main import OAuthLogin

_logger = logging.getLogger(__name__)


class SahyogOAuthLogin(OAuthLogin):

    @http.route('/auth_oauth/signin', type='http', auth='none')
    def signin(self, **kw):
        """Override OAuth signin to redirect volunteers to SPA after login."""
        response = super().signin(**kw)

        # After successful login, check if we should redirect to SPA
        if response.status_code in (301, 302, 303):
            location = response.headers.get('Location', '')
            # If redirecting to /web or /web/login, check if volunteer
            if '/web' in location and '/web/login' not in location:
                try:
                    user = request.env.user
                    if user and not user._is_public():
                        admin_group = request.env.ref('sahyog.group_sahyog_admin', raise_if_not_found=False)
                        is_admin = admin_group and admin_group in user.group_ids
                        if not is_admin:
                            has_employee = bool(request.env['hr.employee'].sudo().search(
                                [('user_id', '=', user.id)], limit=1))
                            if has_employee:
                                return request.redirect('/sahyog/app')
                except Exception:
                    _logger.exception('Error checking volunteer redirect after OAuth')

        return response
