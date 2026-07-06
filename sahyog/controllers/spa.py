import json
import logging
import os

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

_ASSET_BASE = '/sahyog/static/dist/volunteer_app'
_MANIFEST_PATH = os.path.join(
    os.path.dirname(__file__), '..', 'static', 'dist', 'volunteer_app',
    '.vite', 'manifest.json',
)
# In-memory cache of the resolved asset URLs, refreshed when the manifest
# file's mtime changes (so a rebuild is reflected without an Odoo restart).
_manifest_cache = {'mtime': None, 'assets': None}


def _spa_assets():
    """Return {'js': url, 'css': [urls]} for the built SPA.

    Reads the Vite manifest so content-hashed filenames (cache-busting) are
    picked up automatically. Falls back to legacy fixed filenames if the
    manifest is missing (e.g. an older build).
    """
    fallback = {
        'js': _ASSET_BASE + '/assets/index.js',
        'css': [_ASSET_BASE + '/assets/index.css'],
    }
    try:
        mtime = os.path.getmtime(_MANIFEST_PATH)
    except OSError:
        return fallback
    if _manifest_cache['mtime'] != mtime:
        try:
            with open(_MANIFEST_PATH, 'r') as fh:
                manifest = json.load(fh)
            entry_key = next(
                (k for k, v in manifest.items() if v.get('isEntry')),
                'index.html',
            )
            entry = manifest.get(entry_key, {})
            # Collect CSS from the entry AND its transitive imports — with
            # vendor/mantine code-splitting the stylesheet is attached to an
            # imported chunk, not the entry itself.
            css, seen = [], set()

            def _collect(key):
                if key in seen:
                    return
                seen.add(key)
                node = manifest.get(key, {})
                for href in node.get('css', []):
                    if href not in css:
                        css.append(href)
                for imp in node.get('imports', []):
                    _collect(imp)

            _collect(entry_key)
            _manifest_cache['assets'] = {
                'js': _ASSET_BASE + '/' + entry['file'],
                'css': [_ASSET_BASE + '/' + c for c in css],
            }
            _manifest_cache['mtime'] = mtime
        except (OSError, ValueError, KeyError):
            _logger.exception('Failed to read SPA Vite manifest')
            return fallback
    return _manifest_cache['assets'] or fallback


class SahyogSPA(http.Controller):

    def _blocked_page(self, status):
        """Return an HTML page telling the volunteer their account is inactive."""
        status_label = 'Away' if status == 'away' else 'Left'
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
    <title>Sahyog — Access Restricted</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        html, body {{ min-height: 100vh; min-height: 100dvh; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; display: flex; align-items: center; justify-content: center; }}
        .card {{ background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px 32px; max-width: 420px; width: 90%; text-align: center; }}
        .icon {{ font-size: 48px; margin-bottom: 16px; }}
        .title {{ font-size: 20px; font-weight: 700; color: #333; margin-bottom: 8px; }}
        .message {{ color: #868e96; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }}
        .status-badge {{ display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 13px; font-weight: 600; background: #fff3bf; color: #e67700; }}
        .logout-link {{ display: inline-block; margin-top: 16px; color: #868e96; font-size: 13px; text-decoration: none; }}
        .logout-link:hover {{ color: #495057; text-decoration: underline; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">🚫</div>
        <div class="title">Access Restricted</div>
        <div class="message">
            Your volunteer status is currently <span class="status-badge">{status_label}</span>
            <br/><br/>
            You cannot access the Sahyog portal while your status is {status_label.lower()}.
            Please contact your admin if you believe this is an error.
        </div>
        <a href="/web/session/logout?redirect=/sahyog/login" class="logout-link">Logout</a>
    </div>
</body>
</html>"""

    def _no_account_page(self):
        """Return an HTML page for users who don't have a volunteer account."""
        return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
    <title>Sahyog — No Account</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { min-height: 100vh; min-height: 100dvh; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; display: flex; align-items: center; justify-content: center; }
        .card { background: #fff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 40px 32px; max-width: 420px; width: 90%; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: 700; color: #333; margin-bottom: 8px; }
        .message { color: #868e96; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
        .logout-link { display: inline-block; margin-top: 16px; color: #868e96; font-size: 13px; text-decoration: none; }
        .logout-link:hover { color: #495057; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">🔒</div>
        <div class="title">No Account Found</div>
        <div class="message">
            Your email is not registered as a volunteer in Sahyog.
            <br/><br/>
            Please contact your admin to get added to the system.
        </div>
        <a href="/web/session/logout?redirect=/sahyog/login" class="logout-link">Logout</a>
    </div>
</body>
</html>"""

    # auth='public': with auth='user' the framework redirects to the stock
    # /web/login before this method runs — public + explicit check lets us
    # route to the branded /sahyog/login with the deep link preserved.
    @http.route(
        ['/sahyog/app', '/sahyog/app/<path:subpath>'],
        type='http', auth='public', website=False,
    )
    def serve_spa(self, subpath=None, **kw):
        """Serve the React SPA HTML shell."""
        user = request.env.user
        if not user or user._is_public():
            # Preserve the deep link through the login flow
            from urllib.parse import quote
            return request.redirect(
                '/sahyog/login?redirect=' + quote(request.httprequest.full_path.rstrip('?')))

        # Block volunteers whose base_status is 'away' or 'left'
        employee = request.env['hr.employee'].sudo().search(
            [('user_id', '=', user.id)], limit=1)
        if employee and employee.base_status in ('away', 'left'):
            return request.make_response(self._blocked_page(employee.base_status), headers=[
                ('Content-Type', 'text/html; charset=utf-8'),
            ])

        csrf_token = request.csrf_token()
        base_url = request.httprequest.url_root.rstrip('/')
        assets = _spa_assets()
        css_links = '\n    '.join(
            f'<link rel="stylesheet" href="{href}" />' for href in assets['css']
        )
        js_script = f'<script type="module" src="{assets["js"]}"></script>'
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf_token" content="{csrf_token}" />
    <meta name="description" content="Sahyog — Volunteer management portal for Isha Guest Care. Browse programs, request silence & breaks, view team calendar." />
    <meta name="theme-color" content="#228be6" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Sahyog" />
    <!-- Open Graph -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Sahyog — Volunteer Portal" />
    <meta property="og:description" content="Volunteer management portal for Isha Guest Care. Browse programs, request silence & breaks, view team calendar." />
    <meta property="og:image" content="{base_url}/sahyog/static/pwa/icon-512.png" />
    <meta property="og:url" content="{base_url}/sahyog/app" />
    <meta property="og:site_name" content="Sahyog" />
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Sahyog — Volunteer Portal" />
    <meta name="twitter:description" content="Volunteer management portal for Isha Guest Care." />
    <meta name="twitter:image" content="{base_url}/sahyog/static/pwa/icon-512.png" />
    <link rel="apple-touch-icon" href="/sahyog/static/pwa/icon-192.png" />
    <link rel="manifest" href="/sahyog/static/dist/volunteer_app/manifest.json" />
    <title>Sahyog — Volunteer Portal</title>
    {css_links}
</head>
<body>
    <div id="root"></div>
    {js_script}
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
        employee = request.env['hr.employee'].sudo().search(
            [('user_id', '=', user.id)], limit=1)
        has_employee = bool(employee)

        # Admin → backend, no employee → access denied
        if is_admin:
            return request.redirect('/web')

        if not has_employee:
            return request.make_response(self._no_account_page(), headers=[
                ('Content-Type', 'text/html; charset=utf-8'),
            ])

        # Block volunteers whose base_status is 'away' or 'left'
        if employee.base_status in ('away', 'left'):
            return request.make_response(self._blocked_page(employee.base_status), headers=[
                ('Content-Type', 'text/html; charset=utf-8'),
            ])

        return request.redirect('/sahyog/app')

    @http.route('/', type='http', auth='public', website=False)
    def root_redirect(self, **kw):
        """Root URL: logged in → role redirect, not logged in → login page."""
        if request.env.user._is_public():
            return request.redirect('/sahyog/login')
        return request.redirect('/sahyog/redirect')

    @http.route(['/my', '/my/home'], type='http', auth='user', website=True)
    def my_redirect(self, **kw):
        """Override /my to redirect based on role instead of showing portal."""
        return request.redirect('/sahyog/redirect')

    SAHYOG_BRAND = {
        'name': 'Sahyog',
        'tagline': 'Volunteer Portal \u2014 Isha Guest Care',
        'icon': '/sahyog/static/pwa/icon-192.png',
        'image': '/sahyog/static/pwa/login.jpg',
        'default_redirect': '/sahyog/redirect',
        'login_url': '/sahyog/login',
    }

    @http.route('/sahyog/login', type='http', auth='public', website=False,
                methods=['GET', 'POST'])
    def custom_login(self, **kw):
        """Branded login (shared split-panel page, Google OAuth + password)."""
        from .login_page import handle_login
        return handle_login(self.SAHYOG_BRAND, **kw)
