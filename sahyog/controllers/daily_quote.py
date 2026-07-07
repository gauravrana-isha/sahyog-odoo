"""Sadhguru daily quote — shared fetcher + the sahyog endpoint.

Proxies Isha's public wisdom API server-side (no CORS, browser never talks
to the external host), caches the result per day per worker, and falls back
to a small set of brief attributed quotes so the UI never renders empty.
The Vaani (isha_pr) endpoint reuses fetch_daily_quote() from here.
"""

import datetime
import json
import logging
import urllib.parse
import urllib.request

from odoo import http
from .base import SahyogControllerBase

_logger = logging.getLogger(__name__)

_QUOTE_URL = 'https://iso-facade.sadhguru.org/content/fetchcsr/content'

# Brief attributed fallbacks so the card never renders empty.
_FALLBACKS = [
    'If you resist change, you resist life.',
    'Life is a process, not a problem.',
    'When pain, misery, or anger happen, it is time to look within you, '
    'not around you.',
    'Do not try to be special. If you are simply ordinary, you will '
    'become extraordinary.',
    'The most beautiful moments in life are moments when you are '
    'expressing your joy, not when you are seeking it.',
]

_cache = {'date': None, 'payload': None}


def fetch_daily_quote():
    """Return {'quote': str, 'source': 'api'|'fallback'}, cached per day."""
    today = datetime.date.today().isoformat()
    if _cache['date'] == today and _cache['payload']:
        return _cache['payload']

    quote, source = '', 'fallback'
    try:
        params = urllib.parse.urlencode({
            'format': 'json', 'sitesection': 'wisdom', 'slug': 'wisdom',
            'lang': '', 'topic': '', 'start': '0', 'limit': '1',
            'contentType': 'quotes', 'sortby': 'newest',
        })
        req = urllib.request.Request(
            f'{_QUOTE_URL}?{params}',
            headers={
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0',
                'Origin': 'https://isha.sadhguru.org',
                'Referer': 'https://isha.sadhguru.org/',
            })
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.load(resp)
        cards = (data.get('posts') or {}).get('cards') or []
        if cards:
            quote = (cards[0].get('summary') or '').strip()
            if quote:
                source = 'api'
    except Exception:
        _logger.warning('Daily quote fetch failed; using fallback')

    if not quote:
        quote = _FALLBACKS[sum(ord(c) for c in today) % len(_FALLBACKS)]

    payload = {'quote': quote, 'source': source}
    _cache.update(date=today, payload=payload)
    return payload


class SahyogQuote(SahyogControllerBase, http.Controller):

    @http.route('/sahyog/api/quote', type='http', auth='user',
                methods=['GET'], csrf=False)
    def sahyog_quote(self, **kw):
        try:
            return self._json_success(fetch_daily_quote())
        except Exception:
            _logger.exception('API error in sahyog_quote')
            return self._json_error('Internal server error', status=500)
