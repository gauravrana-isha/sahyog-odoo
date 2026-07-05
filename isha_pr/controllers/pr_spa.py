"""Serve the PR React SPA at /pr/app (mirrors sahyog's spa.py cache-busting)."""

import json
import logging
import os

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

_ASSET_BASE = '/isha_pr/static/dist/pr_app'
_MANIFEST_PATH = os.path.join(
    os.path.dirname(__file__), '..', 'static', 'dist', 'pr_app',
    '.vite', 'manifest.json',
)
_manifest_cache = {'mtime': None, 'assets': None}


def _pr_assets():
    """Resolve current hashed JS/CSS from the Vite manifest (transitive CSS)."""
    fallback = {'js': _ASSET_BASE + '/assets/index.js',
                'css': [_ASSET_BASE + '/assets/index.css']}
    try:
        mtime = os.path.getmtime(_MANIFEST_PATH)
    except OSError:
        return fallback
    if _manifest_cache['mtime'] != mtime:
        try:
            with open(_MANIFEST_PATH, 'r') as fh:
                manifest = json.load(fh)
            entry_key = next((k for k, v in manifest.items() if v.get('isEntry')),
                             'index.html')
            entry = manifest.get(entry_key, {})
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
            _logger.exception('Failed to read PR SPA Vite manifest')
            return fallback
    return _manifest_cache['assets'] or fallback


class IshaPRSPA(http.Controller):

    @http.route(['/pr/app', '/pr/app/<path:subpath>'], type='http',
                auth='user', website=False)
    def serve_pr_spa(self, subpath=None, **kw):
        user = request.env.user
        if not user or user._is_public():
            return request.redirect('/web/login?redirect=/pr/app')
        if not user.has_group('isha_pr.group_isha_pr'):
            return request.make_response(
                '<h2 style="font-family:sans-serif;text-align:center;margin-top:20vh">'
                'You do not have access to the PR app.</h2>',
                headers=[('Content-Type', 'text/html; charset=utf-8')])

        csrf_token = request.csrf_token()
        assets = _pr_assets()
        css_links = '\n    '.join(
            f'<link rel="stylesheet" href="{href}" />' for href in assets['css'])
        js_script = f'<script type="module" src="{assets["js"]}"></script>'
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="csrf_token" content="{csrf_token}" />
    <title>Isha PR</title>
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
