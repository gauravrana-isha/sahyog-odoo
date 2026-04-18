import logging

from odoo import http
from odoo.http import request
from odoo.addons.auth_oauth.controllers.main import OAuthLogin

_logger = logging.getLogger(__name__)


class SahyogOAuthLogin(OAuthLogin):

    @http.route('/auth_oauth/signin', type='http', auth='none')
    def signin(self, **kw):
        """Override OAuth signin to always redirect via /sahyog/redirect."""
        response = super().signin(**kw)

        # After successful login, always redirect to our role-based router
        if response.status_code in (301, 302, 303):
            location = response.headers.get('Location', '')
            # If going to /web, /web/login with error, or anywhere else after login
            if '/web' in location and 'oauth_error' not in location:
                return request.redirect('/sahyog/redirect')

        return response
