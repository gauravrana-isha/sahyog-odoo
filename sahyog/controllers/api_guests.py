"""Guest-visit JSON API — a domain controller split out of api.py (P2.2).

Demonstrates the target structure: a thin controller of routes that reuses the
shared helpers from SahyogControllerBase. Remaining domains follow this same
pattern.
"""

import logging

from odoo import http
from odoo.http import request
from odoo.exceptions import ValidationError
from odoo.addons.sahyog.controllers.base import SahyogControllerBase

_logger = logging.getLogger(__name__)


class SahyogGuestAPI(SahyogControllerBase, http.Controller):

    def _serialize_visit(self, v, full=False):
        """Serialize a guest visit record. If full=True, include all fields."""
        data = {
            'id': v.id,
            'main_guest_name': v.main_guest_name or '',
            'arrival_date': str(v.arrival_date) if v.arrival_date else '',
            'departure_date': str(v.departure_date) if v.departure_date else '',
            'state': v.state or 'draft',
            'feedback_count': v.feedback_count or 0,
            'qr_token': v.qr_token or '',
            'feedback_link': v.feedback_link or '',
            'qr_expiry': str(v.qr_expiry) if v.qr_expiry else '',
            'google_form_synced': v.google_form_synced,
            'volunteer_id': self._m2o(v, 'volunteer_id'),
            'region_id': self._m2o(v, 'region_id'),
            'center_id': self._m2o(v, 'center_id'),
            # The shared person. Name read sudo so serialization never depends
            # on the caller's res.partner access.
            'partner_id': (
                {'id': v.partner_id.id, 'name': v.partner_id.sudo().name}
                if v.partner_id else None
            ),
        }
        if full:
            data.update({
                'gender': v.gender or '',
                'designation_company': v.designation_company or '',
                'company_sector': v.company_sector or '',
                'phone': v.phone or '',
                'email': v.email or '',
                'address': v.address or '',
                'guest_region': v.guest_region or '',
                'accommodation_type': v.accommodation_type or '',
                'reference_of': v.reference_of or '',
                'poc_name': v.poc_name or '',
                'poc_contact': v.poc_contact or '',
                'place_event_ids': self._m2m(v, 'place_event_ids'),
                'places_other': v.places_other or '',
                'accompanying_guest_count': v.accompanying_guest_count or 0,
                'experience_rating': v.experience_rating or '',
                'experience_details': v.experience_details or '',
                'action_required': v.action_required or '',
                'compliments_offered': v.compliments_offered or '',
                'other_remarks': v.other_remarks or '',
                'submitter_email': v.submitter_email or '',
                'google_form_error': v.google_form_error or '',
            })
        return data

    @http.route('/sahyog/api/guest-visits', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_guest_visits(self, **kw):
        """Return current volunteer's visits (own + same region)."""
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            domain = ['|',
                ('volunteer_id', '=', volunteer.id),
                ('region_id', '=', volunteer.region_id.id),
            ]
            visits = request.env['sahyog.guest.visit'].search(
                domain, order='create_date desc',
            )
            return self._json_success([self._serialize_visit(v) for v in visits])
        except Exception:
            _logger.exception('API error in get_guest_visits')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/guest-visits/create', type='http', auth='user',
                methods=['POST'], csrf=False)
    def create_guest_visit(self, **kw):
        """Create a Guest Visit. Supports Quick Create (just main_guest_name) or full field set."""
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            if not data.get('main_guest_name'):
                return self._json_error('main_guest_name is required')

            vals = {
                'volunteer_id': volunteer.id,
                'main_guest_name': data['main_guest_name'],
            }

            # Optional fields
            text_fields = (
                'gender', 'designation_company', 'company_sector', 'phone',
                'email', 'address', 'guest_region', 'accommodation_type', 'reference_of',
                'poc_name', 'poc_contact', 'places_other', 'experience_rating',
                'experience_details', 'action_required', 'compliments_offered',
                'other_remarks',
            )
            for f in text_fields:
                if f in data:
                    vals[f] = data[f]

            date_fields = ('arrival_date', 'departure_date')
            for f in date_fields:
                if data.get(f):
                    vals[f] = data[f]

            if 'accompanying_guest_count' in data:
                vals['accompanying_guest_count'] = int(data['accompanying_guest_count'])

            if 'place_event_ids' in data:
                ids = [int(i) for i in data['place_event_ids']]
                vals['place_event_ids'] = [(6, 0, ids)]

            record = request.env['sahyog.guest.visit'].create(vals)
            return self._json_success(self._serialize_visit(record, full=True))
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in create_guest_visit')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/guest-visits/<int:visit_id>/update', type='http',
                auth='user', methods=['POST'], csrf=False)
    def update_guest_visit(self, visit_id, **kw):
        """Update a Guest Visit. Transitions state to complete when all required fields are present."""
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            visit = request.env['sahyog.guest.visit'].browse(visit_id)
            if not visit.exists():
                return self._json_error('Guest visit not found')
            # Check ownership or same region
            if visit.volunteer_id.id != volunteer.id and visit.region_id.id != volunteer.region_id.id:
                return self._json_error('Access denied', status=403)

            data = self._parse_json()
            vals = {}

            text_fields = (
                'main_guest_name', 'gender', 'designation_company', 'company_sector',
                'phone', 'email', 'address', 'guest_region', 'accommodation_type', 'reference_of',
                'poc_name', 'poc_contact', 'places_other', 'experience_rating',
                'experience_details', 'action_required', 'compliments_offered',
                'other_remarks',
            )
            for f in text_fields:
                if f in data:
                    vals[f] = data[f]

            date_fields = ('arrival_date', 'departure_date')
            for f in date_fields:
                if f in data:
                    vals[f] = data[f] if data[f] else False

            if 'accompanying_guest_count' in data:
                vals['accompanying_guest_count'] = int(data['accompanying_guest_count'])

            if 'place_event_ids' in data:
                ids = [int(i) for i in data['place_event_ids']]
                vals['place_event_ids'] = [(6, 0, ids)]

            if vals:
                visit.write(vals)

            # Check if all required fields are present for state transition
            # Mandatory fields: main_guest_name, arrival_date, accommodation_type,
            # gender, designation_company, company_sector, guest_region,
            # place_event_ids, accompanying_guest_count, experience_rating, experience_details
            v = visit  # shorthand after write
            mandatory_filled = all([
                v.main_guest_name,
                v.arrival_date,
                v.accommodation_type,
                v.gender,
                v.designation_company,
                v.company_sector,
                v.guest_region,
                v.place_event_ids,
                v.accompanying_guest_count is not None and v.accompanying_guest_count >= 0,
                v.experience_rating,
                v.experience_details,
            ])

            if mandatory_filled:
                if visit.state != 'complete':
                    visit.write({'state': 'complete'})
                    # Trigger Google Sheets sync on first completion
                    try:
                        visit._trigger_google_sheets_sync()
                    except Exception:
                        _logger.exception('Google Sheets sync failed for visit %s', visit.id)
                elif not visit.google_form_synced:
                    # Retry sync if previous attempt failed
                    try:
                        visit._trigger_google_sheets_sync()
                    except Exception:
                        _logger.exception('Google Sheets sync retry failed for visit %s', visit.id)

            return self._json_success(self._serialize_visit(visit, full=True))
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in update_guest_visit')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/guest-visits/<int:visit_id>', type='http',
                auth='user', methods=['GET'], csrf=False)
    def get_guest_visit(self, visit_id, **kw):
        """Return a single visit with ALL fields."""
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            visit = request.env['sahyog.guest.visit'].browse(visit_id)
            if not visit.exists():
                return self._json_error('Guest visit not found')
            # Check ownership or same region
            if visit.volunteer_id.id != volunteer.id and visit.region_id.id != volunteer.region_id.id:
                return self._json_error('Access denied', status=403)

            return self._json_success(self._serialize_visit(visit, full=True))
        except Exception:
            _logger.exception('API error in get_guest_visit')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/guest-visits/<int:visit_id>/feedback', type='http',
                auth='user', methods=['GET'], csrf=False)
    def get_guest_visit_feedback(self, visit_id, **kw):
        """Return feedback submissions for a visit."""
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            visit = request.env['sahyog.guest.visit'].browse(visit_id)
            if not visit.exists():
                return self._json_error('Guest visit not found')
            if visit.volunteer_id.id != volunteer.id and visit.region_id.id != volunteer.region_id.id:
                return self._json_error('Access denied', status=403)

            feedbacks = visit.feedback_ids
            return self._json_success([{
                'id': fb.id,
                'guest_name': fb.guest_name or '',
                'contact_phone': fb.contact_phone or '',
                'contact_email': fb.contact_email or '',
                'overall_rating': fb.overall_rating or '',
                'enjoyed_most': fb.enjoyed_most or '',
                'could_be_improved': fb.could_be_improved or '',
                'interested_in_programs': fb.interested_in_programs,
                'want_to_know_initiatives': fb.want_to_know_initiatives,
                'would_visit_again': fb.would_visit_again or '',
                'additional_comments': fb.additional_comments or '',
                'create_date': str(fb.create_date) if fb.create_date else '',
            } for fb in feedbacks])
        except Exception:
            _logger.exception('API error in get_guest_visit_feedback')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/guest-places', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_guest_places(self, **kw):
        """Return guest places filtered by volunteer's center_id."""
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            center_id = volunteer.center_id.id if volunteer.center_id else False
            if center_id:
                domain = ['|',
                    ('center_id', '=', center_id),
                    ('center_id', '=', False),
                ]
            else:
                domain = [('center_id', '=', False)]

            places = request.env['sahyog.guest.place'].search(
                domain, order='sort_order, name',
            )
            return self._json_success([{
                'id': p.id,
                'name': p.name or '',
            } for p in places])
        except Exception:
            _logger.exception('API error in get_guest_places')
            return self._json_error('Internal server error', status=500)
