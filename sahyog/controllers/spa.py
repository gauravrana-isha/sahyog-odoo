import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class SahyogSPA(http.Controller):

    @http.route(
        ['/sahyog/app', '/sahyog/app/<path:subpath>'],
        type='http', auth='user', website=False,
    )
    def serve_spa(self, subpath=None, **kw):
        """Serve the React SPA HTML shell."""
        user = request.env.user
        if not user or user._is_public():
            return request.redirect('/sahyog/login')

        csrf_token = request.csrf_token()
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf_token" content="{csrf_token}" />
    <title>Sahyog Volunteer Portal</title>
    <link rel="stylesheet" href="/sahyog/static/dist/volunteer_app/assets/index.css" />
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/sahyog/static/dist/volunteer_app/assets/index.js"></script>
</body>
</html>"""
        return request.make_response(html, headers=[
            ('Content-Type', 'text/html; charset=utf-8'),
        ])

    @http.route('/sahyog/redirect', type='http', auth='user', website=False)
    def post_login_redirect(self, **kw):
        """Redirect users after login based on their role."""
        user = request.env.user
        if not user or user._is_public():
            return request.redirect('/sahyog/login')

        # Admin users go to /web (check both sahyog admin group AND internal user without employee)
        admin_group = request.env.ref('sahyog.group_sahyog_admin', raise_if_not_found=False)
        is_admin = admin_group and admin_group in user.group_ids

        # Check if user has a linked volunteer (hr.employee)
        has_employee = bool(request.env['hr.employee'].sudo().search(
            [('user_id', '=', user.id)], limit=1))

        # Admin → backend, volunteer with employee → SPA, no employee → backend
        if is_admin or not has_employee:
            return request.redirect('/web')

        return request.redirect('/sahyog/app')

    @http.route('/', type='http', auth='public', website=False)
    def root_redirect(self, **kw):
        """Root URL: logged in → role redirect, not logged in → login page."""
        if request.env.user._is_public():
            return request.redirect('/sahyog/login')
        return request.redirect('/sahyog/redirect')

    @http.route('/my', type='http', auth='user', website=False)
    def my_redirect(self, **kw):
        """Override /my to redirect based on role instead of showing portal."""
        return request.redirect('/sahyog/redirect')

    @http.route('/sahyog/login', type='http', auth='public', website=False)
    def custom_login(self, **kw):
        """Custom login page with Google OAuth button + admin fallback."""
        user = request.env.user
        if user and not user._is_public():
            return request.redirect('/sahyog/redirect')

        google_url = ''
        try:
            providers = request.env['auth.oauth.provider'].sudo().search([
                ('enabled', '=', True),
            ])
            for p in providers:
                if 'google' in (p.auth_endpoint or '').lower():
                    import urllib.parse
                    import json as _json
                    state = _json.dumps({
                        'd': request.session.db or 'sahyog',
                        'p': p.id,
                        'r': '/sahyog/redirect',
                    })
                    params = {
                        'client_id': p.client_id,
                        'redirect_uri': request.httprequest.url_root.rstrip('/') + '/auth_oauth/signin',
                        'response_type': 'token',
                        'scope': p.scope or 'openid email profile',
                        'state': state,
                    }
                    google_url = p.auth_endpoint + '?' + urllib.parse.urlencode(params)
                    break
        except Exception:
            _logger.exception('Failed to build Google OAuth URL')

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
    <title>Sahyog — Login</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        html, body {{ min-height: 100vh; min-height: 100dvh; overflow: hidden; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; display: flex; align-items: center; justify-content: center; }}
        .login-card {{ background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px 32px; max-width: 380px; width: 90%; text-align: center; max-height: 90vh; max-height: 90dvh; overflow-y: auto; }}
        .logo {{ font-size: 28px; font-weight: 700; color: #228be6; margin-bottom: 6px; }}
        .subtitle {{ color: #868e96; font-size: 13px; margin-bottom: 28px; }}
        .google-btn {{ display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; padding: 12px 20px; border: 1px solid #dee2e6; border-radius: 8px; background: #fff; font-size: 15px; font-weight: 500; color: #333; cursor: pointer; text-decoration: none; transition: all 0.15s; }}
        .google-btn:hover {{ background: #f8f9fa; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
        .google-btn svg {{ width: 20px; height: 20px; }}
        .divider {{ margin: 20px 0; color: #adb5bd; font-size: 12px; }}
        .admin-link {{ color: #adb5bd; font-size: 12px; text-decoration: none; }}
        .admin-link:hover {{ color: #868e96; text-decoration: underline; }}
    </style>
</head>
<body>
    <div class="login-card">
        <div class="logo">Sahyog</div>
        <div class="subtitle">Volunteer Management Portal</div>

        {'<a href="' + google_url + '" class="google-btn"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>Login with Google</a>' if google_url else '<p style="color:#e03131;">Google login not configured</p>'}

        <div class="divider">— or —</div>

        <a href="/web/login" class="admin-link">Admin login with password</a>
    </div>
</body>
</html>"""
        return request.make_response(html, headers=[
            ('Content-Type', 'text/html; charset=utf-8'),
        ])
