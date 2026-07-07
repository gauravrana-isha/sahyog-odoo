"""PR JSON API — contacts, interactions, images, capabilities.

Reuses SahyogControllerBase (envelope, helpers, json_endpoint) from sahyog.
Interactions are center-scoped by isha_pr's record rules; controllers query
through plain `request.env` so the rules apply. The only sudo is for genuine
cross-department reads (the summary-only guest history) and reading the user's
own center list.
"""

import functools
import logging

from odoo import http
from odoo.http import request
from odoo.exceptions import ValidationError, AccessError, UserError
from odoo.addons.sahyog.controllers.base import SahyogControllerBase, json_endpoint

_logger = logging.getLogger(__name__)


def require_pr(func):
    """Gate a PR API endpoint on isha_pr.group_isha_pr membership.

    res.partner is readable by every internal Odoo user, so without this the
    contact endpoints would leak the PR contact base to non-PR staff. Applied to
    all data endpoints; returns a 403 envelope before the handler runs. (pr_me and
    pr_quote stay open — capability discovery / harmless.)"""
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        if not request.env.user.has_group('isha_pr.group_isha_pr'):
            return self._json_error('PR access required', status=403)
        return func(self, *args, **kwargs)
    return wrapper

PR_CAPABILITIES = ['pr_view_dashboard', 'pr_view_contacts', 'pr_log_interaction',
                   'pr_view_nominations', 'pr_view_followups', 'pr_view_collabs']

# Scalar partner fields the SPA may write directly.
_WRITABLE_SCALARS = (
    'name', 'pr_alternate_name', 'email', 'pr_secondary_email', 'phone',
    'pr_secondary_phone', 'pr_whatsapp', 'pr_gender', 'pr_involvement', 'pr_source',
    'pr_source_detail', 'pr_met_sadhguru', 'pr_follows_sg', 'pr_vip', 'function',
    'company_name', 'street', 'street2', 'city', 'zip', 'comment', 'pr_poc_notes',
    'pr_social_links', 'pr_primary_poc_email', 'pr_secondary_poc_email',
)
_WRITABLE_M2O = ('state_id', 'country_id', 'pr_region_id',
                 'pr_owner_id', 'pr_primary_poc_id', 'pr_secondary_poc_id')


class IshaPRAPI(SahyogControllerBase, http.Controller):

    # ── Helpers ─────────────────────────────────────────────────────────

    def _pr_centers(self):
        user = request.env.user
        if user.has_group('isha_pr.group_isha_pr_global'):
            return request.env['sahyog.center'].sudo().search([])
        return user.sudo().pr_center_ids

    def _find_or_create_named(self, model, names):
        """Map a list of names to ids on a simple name-master, creating any
        that don't exist (create-on-the-fly for programs/campaigns)."""
        Model = request.env[model]
        ids = []
        for name in names or []:
            name = (name or '').strip()
            if not name:
                continue
            rec = Model.search([('name', '=ilike', name)], limit=1)
            if not rec:
                rec = Model.create({'name': name})
            ids.append(rec.id)
        return ids

    def _image_url(self, model, rec_id, field):
        return f'/web/image/{model}/{rec_id}/{field}'

    def _guest_summary(self, partner):
        """Summary-only guest history — PR sees THAT a person was hosted, not
        Guest Care's feedback. Read sudo (guest visits are another dept's)."""
        Visit = request.env['sahyog.guest.visit'].sudo()
        visits = Visit.search([('partner_id', '=', partner.id)], order='arrival_date desc')
        last = visits[:1]
        return {
            'visit_count': len(visits),
            'last_visit': ({
                'arrival_date': str(last.arrival_date) if last.arrival_date else '',
                'center': last.center_id.name if last.center_id else '',
            } if last else None),
        }

    def _poc_dict(self, poc):
        return {'id': poc.id, 'name': poc.name, 'email': poc.email or ''} if poc else None

    def _contact_dict(self, p, full=False):
        data = {
            'id': p.id,
            'name': p.name or '',
            'email': p.email or '',
            'phone': p.phone or '',
            'pr_involvement': p.pr_involvement or '',
            'is_pr_contact': p.is_pr_contact,
            'vip': p.pr_vip,
            'interaction_count': p.pr_interaction_count,
            'image_url': self._image_url('res.partner', p.id, 'image_128') if p.image_1920 else None,
        }
        if not full:
            return data

        interactions = p.pr_interaction_ids  # center-scoped by record rule
        follow_ups = [i.follow_up_date for i in interactions if i.follow_up_date]
        dates = [i.date for i in interactions if i.date]
        data.update({
            'alternate_name': p.pr_alternate_name or '',
            'secondary_email': p.pr_secondary_email or '',
            'secondary_phone': p.pr_secondary_phone or '',
            'whatsapp': p.pr_whatsapp or '',
            'gender': p.pr_gender or '',
            'function': p.function or '',            # Designation
            'company_name': p.company_name or (p.parent_id.name if p.parent_id else ''),
            'street': p.street or '',
            'street2': p.street2 or '',
            'city': p.city or '',
            'zip': p.zip or '',
            'state_id': self._m2o(p, 'state_id'),
            'country_id': self._m2o(p, 'country_id'),
            'region_id': self._m2o(p, 'pr_region_id'),
            'source': p.pr_source or '',
            'source_detail': p.pr_source_detail or '',
            'social_links': p.pr_social_links or '',
            'met_sadhguru': p.pr_met_sadhguru,
            'follows_sg': p.pr_follows_sg,
            'owner': self._m2o(p, 'pr_owner_id'),
            'tags': self._m2m(p, 'category_id'),
            'notes': p.comment or '',
            'programs': self._m2m(p, 'pr_program_ids'),
            'campaigns': self._m2m(p, 'pr_campaign_ids'),
            'related': self._m2m(p, 'pr_related_partner_ids'),
            'primary_poc': self._poc_dict(p.pr_primary_poc_id),
            'secondary_poc': self._poc_dict(p.pr_secondary_poc_id),
            'primary_poc_email': p.pr_primary_poc_email or '',
            'secondary_poc_email': p.pr_secondary_poc_email or '',
            'poc_notes': p.pr_poc_notes or '',
            'images': [{
                'id': img.id, 'kind': img.kind, 'label': img.label or '',
                'url': self._image_url('pr.contact.image', img.id, 'image_512'),
            } for img in p.pr_image_ids],
            'has_portrait': bool(p.image_1920),
            'portrait_url': self._image_url('res.partner', p.id, 'image_512') if p.image_1920 else None,
            'last_interaction': str(max(dates)) if dates else '',
            'next_followup': str(min(follow_ups)) if follow_ups else '',
            'interactions': [i.to_spa_dict() for i in interactions],
            'guest_summary': self._guest_summary(p),
        })
        return data

    def _apply_vals(self, data):
        """Build a res.partner write/create dict from incoming SPA data."""
        vals = {}
        for f in _WRITABLE_SCALARS:
            if f in data:
                vals[f] = data[f]
        for f in _WRITABLE_M2O:
            if f in data:
                vals[f] = int(data[f]) if data[f] else False
        if 'tag_ids' in data:
            vals['category_id'] = [(6, 0, [int(i) for i in data['tag_ids']])]
        if 'related_ids' in data:
            vals['pr_related_partner_ids'] = [(6, 0, [int(i) for i in data['related_ids']])]
        if 'program_names' in data:
            vals['pr_program_ids'] = [(6, 0, self._find_or_create_named('pr.program', data['program_names']))]
        if 'campaign_names' in data:
            vals['pr_campaign_ids'] = [(6, 0, self._find_or_create_named('pr.campaign', data['campaign_names']))]
        if data.get('image_1920'):
            vals['image_1920'] = data['image_1920']
        return vals

    # ── Daily quote (proxied from Isha's public wisdom API) ─────────────

    _QUOTE_URL = 'https://iso-facade.sadhguru.org/content/fetchcsr/content'
    # Short attributed fallbacks so the card never renders empty.
    _QUOTE_FALLBACKS = [
        'If you resist change, you resist life.',
        'Life is a process, not a problem.',
        'When pain, misery, or anger happen, it is time to look within you, '
        'not around you.',
        'Do not try to be special. If you are simply ordinary, you will '
        'become extraordinary.',
        'The most beautiful moments in life are moments when you are '
        'expressing your joy, not when you are seeking it.',
    ]
    _quote_cache = {'date': None, 'payload': None}

    @http.route('/pr/api/quote', type='http', auth='user', methods=['GET'], csrf=False)
    def pr_quote(self, **kw):
        import datetime
        import json as _json
        import urllib.parse
        import urllib.request

        today = datetime.date.today().isoformat()
        cache = IshaPRAPI._quote_cache
        if cache['date'] == today and cache['payload']:
            return self._json_success(cache['payload'])

        quote, source = '', 'fallback'
        try:
            params = urllib.parse.urlencode({
                'format': 'json', 'sitesection': 'wisdom', 'slug': 'wisdom',
                'lang': '', 'topic': '', 'start': '0', 'limit': '1',
                'contentType': 'quotes', 'sortby': 'newest',
            })
            req = urllib.request.Request(
                f'{self._QUOTE_URL}?{params}',
                headers={
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0',
                    'Origin': 'https://isha.sadhguru.org',
                    'Referer': 'https://isha.sadhguru.org/',
                })
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = _json.load(resp)
            cards = (data.get('posts') or {}).get('cards') or []
            if cards:
                quote = (cards[0].get('summary') or '').strip()
                if quote:
                    source = 'api'
        except Exception:
            _logger.warning('Daily quote fetch failed; using fallback')

        if not quote:
            idx = sum(ord(c) for c in today) % len(self._QUOTE_FALLBACKS)
            quote = self._QUOTE_FALLBACKS[idx]

        payload = {'quote': quote, 'source': source}
        IshaPRAPI._quote_cache = {'date': today, 'payload': payload}
        return self._json_success(payload)

    # ── Identity & capabilities ─────────────────────────────────────────

    @http.route('/pr/api/me', type='http', auth='user', methods=['GET'], csrf=False)
    @json_endpoint
    def pr_me(self, **kw):
        user = request.env.user
        is_pr = user.has_group('isha_pr.group_isha_pr')
        is_global = user.has_group('isha_pr.group_isha_pr_global')
        is_admin = user.has_group('isha_pr.group_isha_pr_admin')
        can = {key: is_pr for key in PR_CAPABILITIES}
        can['admin'] = is_admin
        # Regions are a shared name-master (contacts carry pr_region_id);
        # read sudo like centers — it holds no sensitive data.
        regions = request.env['sahyog.region'].sudo().search([])
        return {
            'user': {'id': user.id, 'name': user.name, 'login': user.login},
            'groups': {'pr': is_pr, 'global': is_global, 'admin': is_admin},
            'centers': [{'id': c.id, 'name': c.name} for c in self._pr_centers()],
            'regions': [{'id': r.id, 'name': r.name} for r in regions],
            'can': can,
        }

    # ── Dashboard / home stats ──────────────────────────────────────────

    @http.route('/pr/api/dashboard', type='http', auth='user', methods=['GET'], csrf=False)
    @json_endpoint
    @require_pr
    def pr_dashboard(self, **kw):
        Nom = request.env['pr.nomination']

        def c(dom):
            return Nom.search_count(dom)

        stages = ['nominated', 'researched', 'approved', 'nurturing', 'rejected']
        by_stage = {s: c([('stage', '=', s)]) for s in stages}
        by_tier = {t: c([('tier', '=', t)]) for t in ('1', '2', '3')}
        verts = dict(Nom._fields['vertical'].selection)
        top_verticals = sorted(
            ({'vertical': k, 'label': v, 'count': c([('vertical', '=', k)])}
             for k, v in verts.items() if k not in ('uncategorized', 'review')),
            key=lambda x: -x['count'])[:6]
        # Submissions per month (last 12 months, oldest first) for the trend
        # chart. `key` (YYYY-MM) drives chart→list drill-down; `month` is the
        # display label.
        monthly = Nom._read_group(
            [('submission_date', '!=', False)],
            groupby=['submission_date:month'],
            aggregates=['__count'],
        )
        by_month = [{
            'month': month.strftime('%b %Y') if month else '',
            'key': month.strftime('%Y-%m') if month else '',
            'count': count,
        } for month, count in monthly][-12:]

        return {
            'total': c([]),
            'priority_leads': c(['&', ('stage', '!=', 'rejected'),
                                 '|', ('tier', '=', '1'), ('high_priority', '=', True)]),
            'nurturing': by_stage['nurturing'],
            'needs_review': c([('research_status', 'in', ('needs_review', 'more_info_required'))]),
            'with_outreach': c([('outreach_ids', '!=', False)]),
            'to_research': by_stage['nominated'],
            'by_stage': by_stage,
            'by_tier': by_tier,
            'top_verticals': [x for x in top_verticals if x['count']],
            'by_month': by_month,
            'collabs': self._collab_stats(),
        }

    def _collab_stats(self):
        C = request.env['pr.collab.request']
        return {
            'total': C.search_count([]),
            'to_evaluate': C.search_count([('stage', '=', 'received')]),
            'to_decide': C.search_count([('stage', '=', 'evaluated')]),
            'high_risk': C.search_count([('risk_level', '=', 'high'),
                                         ('stage', 'not in', ('declined', 'actioned'))]),
        }

    def _collab_overview(self):
        """Global breakdowns for the collaborations list header (unfiltered)."""
        C = request.env['pr.collab.request']
        by_stage = {g['stage']: g['stage_count']
                    for g in C.read_group([], ['stage'], ['stage'])}
        by_rec = {g['recommendation']: g['recommendation_count'] for g in
                  C.read_group([('recommendation', '!=', False)],
                               ['recommendation'], ['recommendation'])}
        by_risk = {g['risk_level']: g['risk_level_count'] for g in
                   C.read_group([('risk_level', '!=', False)], ['risk_level'], ['risk_level'])}
        stats = self._collab_stats()
        return {
            'total': stats['total'],
            'to_evaluate': stats['to_evaluate'],
            'to_decide': stats['to_decide'],
            'high_risk': stats['high_risk'],
            'by_stage': by_stage,
            'by_recommendation': by_rec,
            'by_risk': by_risk,
        }

    # ── Master data for pickers ─────────────────────────────────────────

    @http.route('/pr/api/programs', type='http', auth='user', methods=['GET'], csrf=False)
    @require_pr
    def pr_programs(self, **kw):
        try:
            recs = request.env['pr.program'].search([])
            return self._json_success([{'id': r.id, 'name': r.name} for r in recs])
        except Exception:
            _logger.exception('PR API error in pr_programs')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/campaigns', type='http', auth='user', methods=['GET'], csrf=False)
    @require_pr
    def pr_campaigns(self, **kw):
        try:
            recs = request.env['pr.campaign'].search([])
            return self._json_success([{'id': r.id, 'name': r.name} for r in recs])
        except Exception:
            _logger.exception('PR API error in pr_campaigns')
            return self._json_error('Internal server error', status=500)

    # ── Pagination helper ───────────────────────────────────────────────

    def _list_params(self, kw, field_map, default_order, desc_defaults=(), max_limit=100):
        """Parse offset/limit/order query params.

        `order` accepts a comma-separated list of `field` or `field.asc` /
        `field.desc` tokens (multi-column sort from the table headers). Field
        names resolve through a whitelist map — never raw SQL from the client.
        Unknown tokens are dropped; an empty result falls back to the default.
        """
        try:
            offset = max(0, int(kw.get('offset', 0)))
        except (TypeError, ValueError):
            offset = 0
        try:
            limit = int(kw.get('limit', 50))
        except (TypeError, ValueError):
            limit = 50
        limit = max(1, min(limit, max_limit))

        parts = []
        for token in (kw.get('order') or '').split(','):
            token = token.strip()
            if not token:
                continue
            field, _, direction = token.partition('.')
            column = field_map.get(field)
            if not column:
                continue
            if direction not in ('asc', 'desc'):
                direction = 'desc' if field in desc_defaults else 'asc'
            parts.append(f'{column} {direction}')
        order = ', '.join(parts) if parts else default_order
        if 'id' not in order:
            order += ', id desc'  # stable tiebreaker
        return offset, limit, order

    # ── Contacts ────────────────────────────────────────────────────────

    _CONTACT_SORT_FIELDS = {
        'name': 'name',
        'newest': 'id',
        'vip': 'pr_vip',
        'involvement': 'pr_involvement',
    }
    _CONTACT_DESC_DEFAULTS = ('newest', 'vip')

    @http.route('/pr/api/contacts', type='http', auth='user', methods=['GET'], csrf=False)
    @require_pr
    def pr_contacts(self, **kw):
        try:
            search = (kw.get('q') or '').strip()
            domain = [('is_pr_contact', '=', True)]
            if search:
                domain += ['|', '|',
                           ('name', 'ilike', search),
                           ('email', 'ilike', search),
                           ('phone', 'ilike', search)]
            region_id = kw.get('region_id')
            if region_id:
                domain.append(('pr_region_id', '=', int(region_id)))
            involvement = kw.get('involvement')
            if involvement in ('low', 'moderate', 'high'):
                domain.append(('pr_involvement', '=', involvement))
            offset, limit, order = self._list_params(
                kw, self._CONTACT_SORT_FIELDS, 'name asc',
                desc_defaults=self._CONTACT_DESC_DEFAULTS)
            Partner = request.env['res.partner']
            total = Partner.search_count(domain)
            partners = Partner.search(domain, offset=offset, limit=limit, order=order)
            return self._json_success({
                'records': [self._contact_dict(p) for p in partners],
                'total': total,
                'offset': offset,
                'limit': limit,
            })
        except Exception:
            _logger.exception('PR API error in pr_contacts')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/contacts/<int:partner_id>', type='http', auth='user',
                methods=['GET'], csrf=False)
    @require_pr
    def pr_contact_detail(self, partner_id, **kw):
        try:
            partner = request.env['res.partner'].browse(partner_id)
            # Scope to PR contacts — don't expose arbitrary partners (employees,
            # guests, vendors) or their guest history through this endpoint.
            if not partner.exists() or not partner.is_pr_contact:
                return self._json_error('Contact not found')
            return self._json_success(self._contact_dict(partner, full=True))
        except Exception:
            _logger.exception('PR API error in pr_contact_detail')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/contacts/create', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_contact_create(self, **kw):
        try:
            data = self._parse_json()
            name = (data.get('name') or '').strip()
            if not name:
                return self._json_error('Name is required')
            Partner = request.env['res.partner']
            email = (data.get('email') or '').strip()
            phone = (data.get('phone') or '').strip()
            partner = Partner.browse()
            if email:
                partner = Partner.search([('email', '=ilike', email)], limit=1)
            if not partner and phone:
                partner = Partner.search([('phone', '=', phone)], limit=1)
            vals = self._apply_vals(data)
            vals['is_pr_contact'] = True
            if partner:
                partner.write(vals)
            else:
                partner = Partner.create(vals)
            return self._json_success(self._contact_dict(partner, full=True))
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('PR API error in pr_contact_create')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/contacts/<int:partner_id>/update', type='http',
                auth='user', methods=['POST'], csrf=False)
    @require_pr
    def pr_contact_update(self, partner_id, **kw):
        try:
            partner = request.env['res.partner'].browse(partner_id)
            # Only PR contacts are editable here — never let a PR user modify an
            # arbitrary partner (employee/guest/vendor) by supplying its id.
            if not partner.exists() or not partner.is_pr_contact:
                return self._json_error('Contact not found')
            data = self._parse_json()
            vals = self._apply_vals(data)
            if vals:
                partner.write(vals)
            return self._json_success(self._contact_dict(partner, full=True))
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('PR API error in pr_contact_update')
            return self._json_error('Internal server error', status=500)

    # ── Contact images (typed gallery: card front/back, etc.) ───────────

    @http.route('/pr/api/contacts/<int:partner_id>/images', type='http',
                auth='user', methods=['POST'], csrf=False)
    @require_pr
    def pr_add_image(self, partner_id, **kw):
        try:
            partner = request.env['res.partner'].browse(partner_id)
            if not partner.exists() or not partner.is_pr_contact:
                return self._json_error('Contact not found')
            data = self._parse_json()
            image = data.get('image')
            if not image:
                return self._json_error('No image data provided')
            record = request.env['pr.contact.image'].create({
                'partner_id': partner_id,
                'image': image,
                'kind': data.get('kind', 'other'),
                'label': data.get('label', ''),
            })
            return self._json_success({
                'id': record.id, 'kind': record.kind, 'label': record.label or '',
                'url': self._image_url('pr.contact.image', record.id, 'image_512'),
            })
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('PR API error in pr_add_image')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/images/<int:image_id>/delete', type='http',
                auth='user', methods=['POST'], csrf=False)
    @require_pr
    def pr_delete_image(self, image_id, **kw):
        try:
            record = request.env['pr.contact.image'].browse(image_id)
            if not record.exists():
                return self._json_error('Image not found')
            record.unlink()
            return self._json_success({'success': True})
        except Exception:
            _logger.exception('PR API error in pr_delete_image')
            return self._json_error('Internal server error', status=500)

    # ── Nominations (pipeline fed by the public /pr/nominate form) ──────

    # Research fields a coordinator may edit from the PWA. Stage moves go
    # through the action endpoint so the model's approval gates apply.
    _NOMINATION_WRITABLE = (
        'tier', 'vertical', 'research_recommendation', 'research_notes',
        'next_step', 'high_priority', 'leadership_position', 'organization',
        'website', 'linkedin', 'instagram', 'social_following',
    )

    _NOMINATION_ACTIONS = {
        'mark_researched': 'action_mark_researched',
        'approve': 'action_approve',
        'reject': 'action_reject',
        'start_nurturing': 'action_start_nurturing',
        'reset': 'action_reset_nominated',
        'archive': 'action_archive', 'unarchive': 'action_unarchive',
    }

    @staticmethod
    def _month_domain(month):
        """'YYYY-MM' → submission_date within that month (chart drill-down)."""
        if not month:
            return []
        try:
            from datetime import date
            year, mon = (int(x) for x in month.split('-'))
            start = date(year, mon, 1)
            end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
            return [('submission_date', '>=', start), ('submission_date', '<', end)]
        except (TypeError, ValueError):
            return []

    _NOMINATION_SORT_FIELDS = {
        'tier': 'tier',
        'newest': 'id',
        'name': 'nominee_id',
        'stage': 'stage',
        'vertical': 'vertical',
        'organization': 'organization',
        'submitted': 'submission_date',
    }
    _NOMINATION_DESC_DEFAULTS = ('newest', 'submitted')

    @http.route('/pr/api/nominations', type='http', auth='user', methods=['GET'], csrf=False)
    @require_pr
    def pr_nominations(self, **kw):
        try:
            domain = []
            if kw.get('stage'):
                domain.append(('stage', '=', kw['stage']))
            if kw.get('tier'):
                domain.append(('tier', '=', kw['tier']))
            if kw.get('vertical'):
                domain.append(('vertical', '=', kw['vertical']))
            # Dashboard drill-downs (must mirror pr_dashboard's metric domains)
            if kw.get('priority'):
                domain += ['&', ('stage', '!=', 'rejected'),
                           '|', ('tier', '=', '1'), ('high_priority', '=', True)]
            if kw.get('flag') == 'review':
                domain.append(('research_status', 'in',
                               ('needs_review', 'more_info_required')))
            domain += self._month_domain(kw.get('month'))
            if kw.get('archived'):
                domain.append(('active', '=', False))
            q = (kw.get('q') or '').strip()
            if q:
                domain += ['|', ('nominee_id.name', 'ilike', q),
                           ('organization', 'ilike', q)]
            offset, limit, order = self._list_params(
                kw, self._NOMINATION_SORT_FIELDS, 'tier asc, id desc',
                desc_defaults=self._NOMINATION_DESC_DEFAULTS)
            Nomination = request.env['pr.nomination']
            total = Nomination.search_count(domain)
            recs = Nomination.search(domain, offset=offset, limit=limit, order=order)
            return self._json_success({
                'records': [r.to_spa_light_dict() for r in recs],
                'total': total,
                'offset': offset,
                'limit': limit,
            })
        except Exception:
            _logger.exception('PR API error in pr_nominations')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/nominations/<int:nid>', type='http', auth='user',
                methods=['GET'], csrf=False)
    @require_pr
    def pr_nomination_detail(self, nid, **kw):
        try:
            rec = request.env['pr.nomination'].browse(nid)
            if not rec.exists():
                return self._json_error('Nomination not found')
            return self._json_success(rec.to_spa_dict())
        except Exception:
            _logger.exception('PR API error in pr_nomination_detail')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/nominations/<int:nid>/update', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_nomination_update(self, nid, **kw):
        try:
            rec = request.env['pr.nomination'].browse(nid)
            if not rec.exists():
                return self._json_error('Nomination not found')
            data = self._parse_json()
            vals = {k: data[k] for k in self._NOMINATION_WRITABLE if k in data}
            if vals:
                rec.write(vals)
            return self._json_success(rec.to_spa_dict())
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('PR API error in pr_nomination_update')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/nominations/bulk-action', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_nomination_bulk_action(self, **kw):
        """Run a stage action on many nominations. The model's gates apply
        per record (approve/reject stay admin-only)."""
        try:
            data = self._parse_json()
            method = self._NOMINATION_ACTIONS.get(data.get('action'))
            ids = [int(i) for i in (data.get('ids') or [])]
            if not method or not ids:
                return self._json_error('Unknown action or empty selection')
            recs = request.env['pr.nomination'].browse(ids).exists()
            getattr(recs, method)()
            return self._json_success({'updated': len(recs)})
        except UserError as e:
            return self._json_error(str(e))
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('PR API error in pr_nomination_bulk_action')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/nominations/<int:nid>/action', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_nomination_action(self, nid, **kw):
        try:
            rec = request.env['pr.nomination'].browse(nid)
            if not rec.exists():
                return self._json_error('Nomination not found')
            data = self._parse_json()
            method = self._NOMINATION_ACTIONS.get(data.get('action'))
            if not method:
                return self._json_error('Unknown action')
            getattr(rec, method)()
            return self._json_success(rec.to_spa_dict())
        except UserError as e:
            return self._json_error(str(e))
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('PR API error in pr_nomination_action')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/nominations/<int:nid>/delete', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_nomination_delete(self, nid, **kw):
        try:
            rec = request.env['pr.nomination'].browse(nid)
            if not rec.exists():
                return self._json_error('Nomination not found')
            rec.action_delete()  # model gates permanent delete to admins
            return self._json_success({'deleted': True})
        except UserError as e:
            return self._json_error(str(e), status=403)
        except Exception:
            _logger.exception('PR API error in pr_nomination_delete')
            return self._json_error('Internal server error', status=500)

    # ── CSV exports (honor the same filters/order as the lists) ─────────

    def _csv_response(self, filename, header, rows):
        import csv
        import io
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(header)
        writer.writerows(rows)
        return request.make_response(buf.getvalue(), headers=[
            ('Content-Type', 'text/csv; charset=utf-8'),
            ('Content-Disposition', f'attachment; filename="{filename}"'),
        ])

    @http.route('/pr/api/nominations/export', type='http', auth='user',
                methods=['GET'], csrf=False)
    @require_pr
    def pr_nominations_export(self, **kw):
        try:
            domain = []
            if kw.get('stage'):
                domain.append(('stage', '=', kw['stage']))
            if kw.get('tier'):
                domain.append(('tier', '=', kw['tier']))
            if kw.get('vertical'):
                domain.append(('vertical', '=', kw['vertical']))
            if kw.get('priority'):
                domain += ['&', ('stage', '!=', 'rejected'),
                           '|', ('tier', '=', '1'), ('high_priority', '=', True)]
            if kw.get('flag') == 'review':
                domain.append(('research_status', 'in',
                               ('needs_review', 'more_info_required')))
            domain += self._month_domain(kw.get('month'))
            q = (kw.get('q') or '').strip()
            if q:
                domain += ['|', ('nominee_id.name', 'ilike', q),
                           ('organization', 'ilike', q)]
            _, _, order = self._list_params(
                kw, self._NOMINATION_SORT_FIELDS, 'tier asc, id desc',
                desc_defaults=self._NOMINATION_DESC_DEFAULTS)
            recs = request.env['pr.nomination'].search(domain, limit=5000, order=order)
            rows = [(
                r.nominee_id.name or '', r.stage or '', r.tier or '',
                r.vertical or '', r.leadership_position or '', r.organization or '',
                str(r.submission_date) if r.submission_date else '',
                r.nominator_name or '', r.nominee_id.email or '', r.nominee_id.phone or '',
            ) for r in recs]
            return self._csv_response('nominations.csv',
                ['Nominee', 'Stage', 'Tier', 'Vertical', 'Role', 'Organization',
                 'Submitted', 'Nominator', 'Email', 'Phone'], rows)
        except Exception:
            _logger.exception('PR API error in pr_nominations_export')
            return self._json_error('Internal server error', status=500)

    # ── Collaboration requests ──────────────────────────────────────────

    _COLLAB_WRITABLE = (
        'name', 'request_type', 'host_names', 'links', 'details', 'source', 'requester_name',
        'requester_email', 'audience_fit', 'host_credibility', 'brand_alignment',
        'content_control', 'guest_history', 'potential_backlash', 'opportunity_cost',
        'long_term_value', 'audience_size', 'avg_views', 'engagement_rate',
        'ratings_score', 'subscriber_view_ratio', 'recommendation', 'recommendation_notes',
        'risk_level', 'eval_summary', 'action_taken', 'notes', 'request_date',
    )
    _COLLAB_ACTIONS = {
        'evaluate': 'action_mark_evaluated', 'approve': 'action_approve',
        'decline': 'action_decline', 'action': 'action_mark_actioned',
        'reset': 'action_reset_received',
        'archive': 'action_archive', 'unarchive': 'action_unarchive',
    }

    @http.route('/pr/api/collabs', type='http', auth='user', methods=['GET'], csrf=False)
    @require_pr
    def pr_collabs(self, **kw):
        try:
            domain = []
            for f in ('stage', 'request_type', 'recommendation'):
                if kw.get(f):
                    domain.append((f, '=', kw[f]))
            if kw.get('risk'):
                domain.append(('risk_level', '=', kw['risk']))
            q = (kw.get('q') or '').strip()
            if q:
                domain += ['|', ('name', 'ilike', q), ('host_names', 'ilike', q)]
            # An explicit active leaf shows archived records (Odoo hides them by default).
            if kw.get('archived'):
                domain.append(('active', '=', False))
            try:
                offset = max(0, int(kw.get('offset', 0)))
                limit = min(200, max(1, int(kw.get('limit', 50))))
            except (TypeError, ValueError):
                offset, limit = 0, 50
            C = request.env['pr.collab.request']
            total = C.search_count(domain)
            recs = C.search(domain, offset=offset, limit=limit, order='request_date desc, id desc')
            return self._json_success({'records': [r.to_spa_light_dict() for r in recs],
                                       'total': total, 'offset': offset, 'limit': limit,
                                       'overview': self._collab_overview()})
        except Exception:
            _logger.exception('PR API error in pr_collabs')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/collabs/<int:cid>', type='http', auth='user', methods=['GET'], csrf=False)
    @require_pr
    def pr_collab_detail(self, cid, **kw):
        try:
            rec = request.env['pr.collab.request'].browse(cid)
            if not rec.exists():
                return self._json_error('Request not found')
            return self._json_success(rec.to_spa_dict())
        except Exception:
            _logger.exception('PR API error in pr_collab_detail')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/collabs/<int:cid>/update', type='http', auth='user', methods=['POST'], csrf=False)
    @require_pr
    def pr_collab_update(self, cid, **kw):
        try:
            rec = request.env['pr.collab.request'].browse(cid)
            if not rec.exists():
                return self._json_error('Request not found')
            data = self._parse_json()
            vals = {k: data[k] for k in self._COLLAB_WRITABLE if k in data}
            if vals:
                rec.write(vals)
            return self._json_success(rec.to_spa_dict())
        except Exception:
            _logger.exception('PR API error in pr_collab_update')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/collabs/create', type='http', auth='user', methods=['POST'], csrf=False)
    @require_pr
    def pr_collab_create(self, **kw):
        try:
            data = self._parse_json()
            if not (data.get('name') or '').strip():
                return self._json_error('An opportunity name is required.')
            vals = {k: data[k] for k in self._COLLAB_WRITABLE if k in data}
            vals['stage'] = 'received'
            rec = request.env['pr.collab.request'].create(vals)
            return self._json_success(rec.to_spa_dict())
        except Exception:
            _logger.exception('PR API error in pr_collab_create')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/collabs/<int:cid>/action', type='http', auth='user', methods=['POST'], csrf=False)
    @require_pr
    def pr_collab_action(self, cid, **kw):
        try:
            rec = request.env['pr.collab.request'].browse(cid)
            if not rec.exists():
                return self._json_error('Request not found')
            data = self._parse_json()
            method = self._COLLAB_ACTIONS.get(data.get('action'))
            if not method:
                return self._json_error('Unknown action')
            getattr(rec, method)()
            return self._json_success(rec.to_spa_dict())
        except UserError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('PR API error in pr_collab_action')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/collabs/<int:cid>/delete', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_collab_delete(self, cid, **kw):
        try:
            rec = request.env['pr.collab.request'].browse(cid)
            if not rec.exists():
                return self._json_error('Request not found')
            rec.action_delete()  # model gates permanent delete to admins
            return self._json_success({'deleted': True})
        except UserError as e:
            return self._json_error(str(e), status=403)
        except Exception:
            _logger.exception('PR API error in pr_collab_delete')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/contacts/export', type='http', auth='user',
                methods=['GET'], csrf=False)
    @require_pr
    def pr_contacts_export(self, **kw):
        try:
            domain = [('is_pr_contact', '=', True)]
            q = (kw.get('q') or '').strip()
            if q:
                domain += ['|', '|',
                           ('name', 'ilike', q),
                           ('email', 'ilike', q),
                           ('phone', 'ilike', q)]
            if kw.get('region_id'):
                domain.append(('pr_region_id', '=', int(kw['region_id'])))
            if kw.get('involvement') in ('low', 'moderate', 'high'):
                domain.append(('pr_involvement', '=', kw['involvement']))
            _, _, order = self._list_params(
                kw, self._CONTACT_SORT_FIELDS, 'name asc',
                desc_defaults=self._CONTACT_DESC_DEFAULTS)
            recs = request.env['res.partner'].search(domain, limit=5000, order=order)
            rows = [(
                p.name or '', p.email or '', p.phone or '',
                p.pr_involvement or '', 'yes' if p.pr_vip else '',
                p.pr_region_id.name or '', p.function or '', p.company_name or '',
            ) for p in recs]
            return self._csv_response('contacts.csv',
                ['Name', 'Email', 'Phone', 'Involvement', 'VIP', 'Region',
                 'Designation', 'Organization'], rows)
        except Exception:
            _logger.exception('PR API error in pr_contacts_export')
            return self._json_error('Internal server error', status=500)

    # ── Follow-ups (interactions with a follow_up_date, center-scoped) ──

    @http.route('/pr/api/followups', type='http', auth='user', methods=['GET'], csrf=False)
    @require_pr
    def pr_followups(self, **kw):
        try:
            recs = request.env['pr.interaction'].search(
                [('follow_up_date', '!=', False)],
                order='follow_up_date', limit=200)
            return self._json_success([r.to_spa_dict() for r in recs])
        except Exception:
            _logger.exception('PR API error in pr_followups')
            return self._json_error('Internal server error', status=500)

    # ── Notifications (record rule limits everything to the own user) ──

    @http.route('/pr/api/notifications', type='http', auth='user', methods=['GET'], csrf=False)
    @require_pr
    def pr_notifications(self, **kw):
        try:
            recs = request.env['pr.notification'].search([], limit=50)
            return self._json_success([r.to_spa_dict() for r in recs])
        except Exception:
            _logger.exception('PR API error in pr_notifications')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/notifications/unread-count', type='http', auth='user',
                methods=['GET'], csrf=False)
    @require_pr
    def pr_notifications_unread(self, **kw):
        try:
            count = request.env['pr.notification'].search_count([('is_read', '=', False)])
            return self._json_success({'count': count})
        except Exception:
            _logger.exception('PR API error in pr_notifications_unread')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/notifications/read', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_notification_read(self, **kw):
        try:
            data = self._parse_json()
            rec = request.env['pr.notification'].browse(int(data['notification_id']))
            if rec.exists():
                rec.write({'is_read': True})
            return self._json_success({'success': True})
        except Exception:
            _logger.exception('PR API error in pr_notification_read')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/notifications/read-all', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_notifications_read_all(self, **kw):
        try:
            request.env['pr.notification'].search([('is_read', '=', False)]).write({'is_read': True})
            return self._json_success({'success': True})
        except Exception:
            _logger.exception('PR API error in pr_notifications_read_all')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/notifications/clear', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_notifications_clear(self, **kw):
        try:
            request.env['pr.notification'].search([]).unlink()
            return self._json_success({'success': True})
        except Exception:
            _logger.exception('PR API error in pr_notifications_clear')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/notifications/delete', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_notification_delete(self, **kw):
        try:
            data = self._parse_json()
            rec = request.env['pr.notification'].browse(int(data['notification_id']))
            if rec.exists():
                rec.unlink()
            return self._json_success({'success': True})
        except Exception:
            _logger.exception('PR API error in pr_notification_delete')
            return self._json_error('Internal server error', status=500)

    # ── Interactions ────────────────────────────────────────────────────

    @http.route('/pr/api/interactions/create', type='http', auth='user',
                methods=['POST'], csrf=False)
    @require_pr
    def pr_interaction_create(self, **kw):
        try:
            data = self._parse_json()
            vals = {
                'partner_id': int(data['partner_id']),
                'center_id': int(data['center_id']),
                'interaction_type': data.get('interaction_type', 'meeting'),
                'subject': data.get('subject', ''),
                'notes': data.get('notes', ''),
            }
            if data.get('date'):
                vals['date'] = data['date']
            if data.get('follow_up_date'):
                vals['follow_up_date'] = data['follow_up_date']
            record = request.env['pr.interaction'].create(vals)
            return self._json_success(record.to_spa_dict())
        except AccessError:
            return self._json_error('You do not have access to that center.')
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('PR API error in pr_interaction_create')
            return self._json_error('Internal server error', status=500)
