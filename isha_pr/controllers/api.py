"""PR JSON API — contacts, interactions, images, capabilities.

Reuses SahyogControllerBase (envelope, helpers, json_endpoint) from sahyog.
Interactions are center-scoped by isha_pr's record rules; controllers query
through plain `request.env` so the rules apply. The only sudo is for genuine
cross-department reads (the summary-only guest history) and reading the user's
own center list.
"""

import logging

from odoo import http
from odoo.http import request
from odoo.exceptions import ValidationError, AccessError
from odoo.addons.sahyog.controllers.base import SahyogControllerBase, json_endpoint

_logger = logging.getLogger(__name__)

PR_CAPABILITIES = ['pr_view_contacts', 'pr_log_interaction', 'pr_view_events']

# Scalar partner fields the SPA may write directly.
_WRITABLE_SCALARS = (
    'name', 'pr_alternate_name', 'email', 'pr_secondary_email', 'phone',
    'pr_secondary_phone', 'pr_whatsapp', 'pr_gender', 'pr_involvement', 'pr_source',
    'pr_met_sadhguru', 'pr_follows_sg', 'pr_vip', 'function', 'company_name',
    'street', 'street2', 'city', 'zip', 'comment', 'pr_poc_notes',
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
        return {
            'user': {'id': user.id, 'name': user.name, 'login': user.login},
            'groups': {'pr': is_pr, 'global': is_global, 'admin': is_admin},
            'centers': [{'id': c.id, 'name': c.name} for c in self._pr_centers()],
            'can': can,
        }

    # ── Master data for pickers ─────────────────────────────────────────

    @http.route('/pr/api/programs', type='http', auth='user', methods=['GET'], csrf=False)
    def pr_programs(self, **kw):
        try:
            recs = request.env['pr.program'].search([])
            return self._json_success([{'id': r.id, 'name': r.name} for r in recs])
        except Exception:
            _logger.exception('PR API error in pr_programs')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/campaigns', type='http', auth='user', methods=['GET'], csrf=False)
    def pr_campaigns(self, **kw):
        try:
            recs = request.env['pr.campaign'].search([])
            return self._json_success([{'id': r.id, 'name': r.name} for r in recs])
        except Exception:
            _logger.exception('PR API error in pr_campaigns')
            return self._json_error('Internal server error', status=500)

    # ── Contacts ────────────────────────────────────────────────────────

    @http.route('/pr/api/contacts', type='http', auth='user', methods=['GET'], csrf=False)
    def pr_contacts(self, **kw):
        try:
            search = (kw.get('q') or '').strip()
            domain = [('is_pr_contact', '=', True)]
            if search:
                domain += ['|', '|',
                           ('name', 'ilike', search),
                           ('email', 'ilike', search),
                           ('phone', 'ilike', search)]
            partners = request.env['res.partner'].search(domain, limit=100, order='name')
            return self._json_success([self._contact_dict(p) for p in partners])
        except Exception:
            _logger.exception('PR API error in pr_contacts')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/contacts/<int:partner_id>', type='http', auth='user',
                methods=['GET'], csrf=False)
    def pr_contact_detail(self, partner_id, **kw):
        try:
            partner = request.env['res.partner'].browse(partner_id)
            if not partner.exists():
                return self._json_error('Contact not found')
            return self._json_success(self._contact_dict(partner, full=True))
        except Exception:
            _logger.exception('PR API error in pr_contact_detail')
            return self._json_error('Internal server error', status=500)

    @http.route('/pr/api/contacts/create', type='http', auth='user',
                methods=['POST'], csrf=False)
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
    def pr_contact_update(self, partner_id, **kw):
        try:
            partner = request.env['res.partner'].browse(partner_id)
            if not partner.exists():
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
    def pr_add_image(self, partner_id, **kw):
        try:
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

    # ── Interactions ────────────────────────────────────────────────────

    @http.route('/pr/api/interactions/create', type='http', auth='user',
                methods=['POST'], csrf=False)
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
