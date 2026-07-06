"""Shared branded login page — used by /sahyog/login and /pr/login.

Split-panel layout: brand image on the left (hero band on mobile), sign-in
panel on the right. Google OAuth button (built from the enabled
auth.oauth.provider) plus an inline email/password form that posts back to
the same route, so errors stay on-brand and the stock /web/login is never
shown. The `redirect` query param is preserved through both flows.

Brand images are expected at <module>/static/pwa/login.jpg; a warm gradient
renders underneath as the fallback until a photo is provided.
"""

import json
import logging
import urllib.parse

from odoo.http import request

_logger = logging.getLogger(__name__)

# Official multicolor Google "G" mark (required branding for the button).
GOOGLE_ICON = (
    '<svg viewBox="0 0 24 24" width="20" height="20">'
    '<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92'
    'a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>'
    '<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77'
    'c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84'
    'C3.99 20.53 7.7 23 12 23z"/>'
    '<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43'
    '.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22'
    '.81-.62z"/>'
    '<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15'
    'C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84'
    'c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>'
)

OAUTH_ERROR_MESSAGES = {
    '1': 'Sign-in with this account is not enabled. Please contact an administrator.',
    '2': 'Access was denied by the sign-in provider. Please try again.',
    '3': 'This Google account is not registered here. Please contact an administrator.',
}


def safe_redirect(raw, default):
    """Only allow local paths — prevents open-redirect via ?redirect=."""
    if raw and raw.startswith('/') and not raw.startswith('//'):
        return raw
    return default


def google_oauth_url(redirect):
    """Build the Google OAuth URL from the configured provider ('' if none)."""
    try:
        providers = request.env['auth.oauth.provider'].sudo().search([
            ('enabled', '=', True),
        ])
        for p in providers:
            if 'google' in (p.auth_endpoint or '').lower():
                state = json.dumps({
                    'd': request.session.db or request.env.cr.dbname,
                    'p': p.id,
                    'r': redirect,
                })
                params = {
                    'client_id': p.client_id,
                    'redirect_uri': request.httprequest.url_root.rstrip('/') + '/auth_oauth/signin',
                    'response_type': 'token',
                    'scope': p.scope or 'openid email profile',
                    'state': state,
                }
                return p.auth_endpoint + '?' + urllib.parse.urlencode(params)
    except Exception:
        _logger.exception('Failed to build Google OAuth URL')
    return ''


def try_password_login(login, password):
    """Authenticate against the current db. Returns an error message or None."""
    if not login or not password:
        return 'Please enter your email and password.'
    try:
        credential = {'login': login, 'password': password, 'type': 'password'}
        request.session.authenticate(request.env, credential)
        return None
    except Exception:
        return 'Incorrect email or password.'


def handle_login(brand, **kw):
    """GET → render the branded page; POST → attempt password login.

    `brand` keys: name, tagline, icon, image, default_redirect.
    """
    user = request.env.user
    if user and not user._is_public():
        return request.redirect(safe_redirect(
            request.params.get('redirect'), brand['default_redirect']))

    error = None
    if request.httprequest.method == 'POST':
        error = try_password_login(
            (request.params.get('login') or '').strip(),
            request.params.get('password') or '')
        if error is None:
            return request.redirect(safe_redirect(
                request.params.get('redirect'), brand['default_redirect']))
    else:
        oauth_error = request.params.get('oauth_error')
        if oauth_error:
            error = OAUTH_ERROR_MESSAGES.get(
                oauth_error, 'Sign-in failed. Please try again.')

    return request.make_response(render_login_page(brand, error=error), headers=[
        ('Content-Type', 'text/html; charset=utf-8'),
    ])


def render_login_page(brand, error=None):
    redirect = safe_redirect(request.params.get('redirect'), brand['default_redirect'])
    google_url = google_oauth_url(redirect)
    csrf_token = request.csrf_token()
    redirect_q = urllib.parse.quote(redirect)

    google_button = (
        f'<a href="{google_url}" class="google-btn">{GOOGLE_ICON}'
        f'<span>Continue with Google</span></a>'
        '<div class="divider"><span>or</span></div>'
    ) if google_url else ''

    error_html = f'<div class="error" role="alert">{error}</div>' if error else ''

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <meta name="theme-color" content="#b0562e"/>
    <link rel="icon" type="image/png" href="{brand['icon']}"/>
    <link rel="apple-touch-icon" href="{brand['icon']}"/>
    <link rel="preconnect" href="https://fonts.googleapis.com"/>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=Karla:wght@400;500;600&display=swap" rel="stylesheet"/>
    <title>{brand['name']} — Sign in</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        :root {{
            --clay: #b0562e; --clay-dark: #944726; --ink: #2b2118;
            --sand: #f3eddf; --surface: #fdfaf3; --line: #e7decb;
            --dim: #8c7d60; --err-bg: #fbecea; --err-fg: #983022;
        }}
        body {{
            font-family: 'Karla', -apple-system, BlinkMacSystemFont, sans-serif;
            color: var(--ink); background: var(--sand);
        }}
        .wrap {{ display: flex; min-height: 100vh; min-height: 100dvh; }}

        /* ── Left: brand image panel ── */
        .pane-image {{
            flex: 1.1; position: relative; display: flex;
            align-items: flex-end; padding: 48px; overflow: hidden;
            background:
                linear-gradient(200deg, rgba(43,33,24,0.15) 0%, rgba(43,33,24,0.65) 100%),
                url('{brand['image']}') center / cover no-repeat,
                radial-gradient(120% 120% at 20% 10%, #d5885a 0%, #b0562e 45%, #5c2e1a 100%);
        }}
        .pane-image .brand {{ position: relative; color: #fff; max-width: 420px; }}
        .pane-image .wordmark {{
            font-family: 'Fraunces', Georgia, serif; font-weight: 600;
            font-size: 46px; line-height: 1.1; letter-spacing: -0.01em;
            text-shadow: 0 2px 12px rgba(43,33,24,0.4);
        }}
        .pane-image .tagline {{
            margin-top: 10px; font-size: 16px; opacity: 0.92;
            text-shadow: 0 1px 8px rgba(43,33,24,0.4);
        }}

        /* ── Right: sign-in panel ── */
        .pane-form {{
            flex: 1; display: grid; place-items: center;
            padding: 48px 24px; background: var(--sand);
        }}
        .card {{ width: 100%; max-width: 380px; }}
        .card .app-icon {{ width: 48px; height: 48px; border-radius: 12px; margin-bottom: 18px; }}
        .card h1 {{
            font-family: 'Fraunces', Georgia, serif; font-weight: 600;
            font-size: 28px; margin-bottom: 4px;
        }}
        .card .sub {{ color: var(--dim); font-size: 14px; margin-bottom: 28px; }}

        .google-btn {{
            display: flex; align-items: center; justify-content: center; gap: 12px;
            width: 100%; padding: 12px 20px; border: 1px solid var(--line);
            border-radius: 10px; background: var(--surface); font-size: 15px;
            font-weight: 600; color: var(--ink); text-decoration: none;
            transition: box-shadow 0.15s, border-color 0.15s;
        }}
        .google-btn:hover {{ border-color: #d5885a; box-shadow: 0 2px 10px rgba(56,40,28,0.1); }}

        .divider {{
            display: flex; align-items: center; gap: 12px;
            margin: 22px 0; color: var(--dim); font-size: 12px;
        }}
        .divider::before, .divider::after {{ content: ''; flex: 1; height: 1px; background: var(--line); }}

        .error {{
            background: var(--err-bg); color: var(--err-fg);
            border: 1px solid #ecb4ac; border-radius: 10px;
            padding: 10px 14px; font-size: 14px; margin-bottom: 18px;
        }}

        label {{ display: block; font-size: 13px; font-weight: 600; margin: 0 0 6px 2px; }}
        input[type=text], input[type=password] {{
            width: 100%; padding: 11px 14px; margin-bottom: 16px;
            font: inherit; color: var(--ink);
            border: 1px solid var(--line); border-radius: 10px;
            background: var(--surface);
        }}
        input:focus {{ outline: 2px solid var(--clay); outline-offset: 0; border-color: var(--clay); }}

        .submit {{
            width: 100%; padding: 12px 20px; border: none; border-radius: 10px;
            background: var(--clay); color: #fff; font: inherit; font-size: 15px;
            font-weight: 600; cursor: pointer; transition: background 0.15s;
        }}
        .submit:hover {{ background: var(--clay-dark); }}

        .foot {{ margin-top: 26px; text-align: center; color: var(--dim); font-size: 12px; }}

        /* ── Mobile: image becomes a hero band ── */
        @media (max-width: 860px) {{
            .wrap {{ flex-direction: column; }}
            .pane-image {{ flex: none; min-height: 190px; padding: 24px; align-items: flex-end; }}
            .pane-image .wordmark {{ font-size: 32px; }}
            .pane-image .tagline {{ font-size: 14px; margin-top: 4px; }}
            .pane-form {{ padding: 32px 20px 48px; }}
        }}
    </style>
</head>
<body>
    <div class="wrap">
        <div class="pane-image">
            <div class="brand">
                <div class="wordmark">{brand['name']}</div>
                <div class="tagline">{brand['tagline']}</div>
            </div>
        </div>
        <div class="pane-form">
            <div class="card">
                <img class="app-icon" src="{brand['icon']}" alt=""/>
                <h1>Sign in</h1>
                <div class="sub">{brand['tagline']}</div>
                {error_html}
                {google_button}
                <form method="post" action="{brand['login_url']}?redirect={redirect_q}">
                    <input type="hidden" name="csrf_token" value="{csrf_token}"/>
                    <input type="hidden" name="redirect" value="{redirect}"/>
                    <label for="login">Email</label>
                    <input type="text" id="login" name="login" autocomplete="username"
                           autocapitalize="none" enterkeyhint="next" autofocus required/>
                    <label for="password">Password</label>
                    <input type="password" id="password" name="password"
                           autocomplete="current-password" enterkeyhint="go" required/>
                    <button type="submit" class="submit">Sign in</button>
                </form>
                <div class="foot">For Isha internal use</div>
            </div>
        </div>
    </div>
</body>
</html>"""
