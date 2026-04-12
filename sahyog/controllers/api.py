import json
import logging

from odoo import http, fields
from odoo.http import request
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class SahyogAPI(http.Controller):

    # ── Helpers ─────────────────────────────────────────────────────────

    def _get_volunteer(self):
        """Return the hr.employee linked to the current user."""
        return request.env['hr.employee'].sudo().search(
            [('user_id', '=', request.env.uid)], limit=1,
        )

    def _json_success(self, data):
        return request.make_json_response({'success': True, 'data': data})

    def _json_error(self, message, status=200):
        return request.make_json_response(
            {'success': False, 'error': message}, status=status,
        )

    def _m2o(self, record, field_name):
        """Return {id, name} for a Many2one field, or None."""
        val = record[field_name]
        if val:
            return {'id': val.id, 'name': val.name}
        return None

    def _m2m(self, record, field_name):
        """Return [{id, name}, ...] for a Many2many field."""
        return [{'id': r.id, 'name': r.name} for r in record[field_name]]

    def _parse_json(self):
        """Parse JSON body from the request."""
        return json.loads(request.httprequest.data)

    # ── Dashboard ───────────────────────────────────────────────────────

    @http.route('/sahyog/api/dashboard', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_dashboard(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            today = fields.Date.context_today(request.env['hr.employee'])

            completed_programs = request.env['sahyog.volunteer.program'].sudo().search_count([
                ('volunteer_id', '=', volunteer.id),
                ('completion_status', '=', 'done'),
            ])

            upcoming_silences = request.env['sahyog.silence.period'].sudo().search([
                ('volunteer_id', '=', volunteer.id),
                ('end_date', '>=', today),
                ('status', 'in', ('approved', 'on_going')),
            ], order='start_date asc')

            upcoming_breaks = request.env['sahyog.break.period'].sudo().search([
                ('volunteer_id', '=', volunteer.id),
                ('end_date', '>=', today),
                ('status', 'in', ('approved', 'on_going')),
            ], order='start_date asc')

            upcoming_programs = request.env['sahyog.volunteer.program'].sudo().search([
                ('volunteer_id', '=', volunteer.id),
                ('end_date', '>=', today),
                ('completion_status', '=', 'upcoming'),
            ], order='start_date asc')

            return self._json_success({
                'status': volunteer.computed_status or 'Available',
                'completed_programs': completed_programs,
                'upcoming_silences': [{
                    'id': s.id,
                    'start_date': str(s.start_date),
                    'end_date': str(s.end_date),
                    'silence_type': s.silence_type or '',
                    'status': s.status,
                    'notes': s.notes or '',
                } for s in upcoming_silences],
                'upcoming_breaks': [{
                    'id': b.id,
                    'start_date': str(b.start_date),
                    'end_date': str(b.end_date),
                    'break_type': b.break_type or '',
                    'status': b.status,
                    'reason': b.reason or '',
                    'notes': b.notes or '',
                } for b in upcoming_breaks],
                'upcoming_programs': [{
                    'id': p.id,
                    'program_name': p.program_id.name or '',
                    'participation_type': p.participation_type or '',
                    'start_date': str(p.start_date),
                    'end_date': str(p.end_date),
                    'location': p.location or '',
                    'completion_status': p.completion_status,
                    'notes': p.notes or '',
                } for p in upcoming_programs],
            })
        except Exception:
            _logger.exception('API error in get_dashboard')
            return self._json_error('Internal server error', status=500)

    # ── Profile ─────────────────────────────────────────────────────────

    @http.route('/sahyog/api/profile', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_profile(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            v = volunteer
            return self._json_success({
                'id': v.id,
                'name': v.name or '',
                'work_email': v.work_email or '',
                'work_phone': v.work_phone or '',
                'whatsapp_number': v.whatsapp_number or '',
                'computed_status': v.computed_status or '',
                'base_status': v.base_status or '',
                'work_mode': v.work_mode or '',
                'sub_team_id': self._m2o(v, 'sub_team_id'),
                'role_in_guest_care': v.role_in_guest_care or '',
                'current_assignment_area': v.current_assignment_area or '',
                'reporting_to_name': v.reporting_to_name or '',
                'sex': v.sex or '',
                'birthday': str(v.birthday) if v.birthday else '',
                'x_nationality': v.x_nationality or '',
                'x_city': v.x_city or '',
                'x_state': v.x_state or '',
                'region_id': self._m2o(v, 'region_id'),
                'language_ids': self._m2m(v, 'language_ids'),
                'volunteer_type_ids': self._m2m(v, 'volunteer_type_ids'),
                'sadhana_practice_ids': self._m2m(v, 'sadhana_practice_ids'),
                'special_skills': v.special_skills or '',
                'health_conditions': v.health_conditions or '',
                'date_of_joining_isha': str(v.date_of_joining_isha) if v.date_of_joining_isha else '',
                'disha_samskriti_batch': v.disha_samskriti_batch or '',
                'date_of_joining_guest_care': str(v.date_of_joining_guest_care) if v.date_of_joining_guest_care else '',
                'added_by': v.added_by or '',
                'emergency_contact_name': v.emergency_contact_name or '',
                'emergency_contact_phone': v.emergency_contact_phone or '',
                'emergency_contact_relation': v.emergency_contact_relation or '',
            })
        except Exception:
            _logger.exception('API error in get_profile')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/profile/update', type='http', auth='user',
                methods=['POST'], csrf=False)
    def update_profile(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            editable_fields = (
                'work_phone', 'whatsapp_number', 'special_skills', 'health_conditions',
                'emergency_contact_name', 'emergency_contact_phone',
                'emergency_contact_relation', 'x_city', 'x_state',
            )
            vals = {k: data[k] for k in editable_fields if k in data}
            if vals:
                volunteer.sudo().write(vals)
            return self._json_success({'success': True})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in update_profile')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/profile/photo', type='http', auth='user',
                methods=['POST'], csrf=False)
    def update_profile_photo(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            image_b64 = data.get('image')
            if not image_b64:
                return self._json_error('No image data provided')

            volunteer.sudo().write({'image_1920': image_b64})
            return self._json_success({'success': True})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in update_profile_photo')
            return self._json_error('Internal server error', status=500)

    # ── Silence Periods ─────────────────────────────────────────────────

    @http.route('/sahyog/api/silence', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_silence(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            silences = request.env['sahyog.silence.period'].sudo().search(
                [('volunteer_id', '=', volunteer.id)], order='start_date desc',
            )
            return self._json_success([{
                'id': s.id,
                'start_date': str(s.start_date),
                'end_date': str(s.end_date),
                'silence_type': s.silence_type or '',
                'status': s.status,
                'notes': s.notes or '',
            } for s in silences])
        except Exception:
            _logger.exception('API error in get_silence')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/silence/create', type='http', auth='user',
                methods=['POST'], csrf=False)
    def create_silence(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record = request.env['sahyog.silence.period'].sudo().create({
                'volunteer_id': volunteer.id,
                'start_date': data['start_date'],
                'end_date': data['end_date'],
                'silence_type': data.get('silence_type', 'personal'),
                'notes': data.get('notes', ''),
                'status': 'pending_admin',
                'created_by': request.env.uid,
            })
            return self._json_success({'id': record.id})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in create_silence')
            return self._json_error('Internal server error', status=500)

    # ── Break Periods ───────────────────────────────────────────────────

    @http.route('/sahyog/api/breaks', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_breaks(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            breaks = request.env['sahyog.break.period'].sudo().search(
                [('volunteer_id', '=', volunteer.id)], order='start_date desc',
            )
            return self._json_success([{
                'id': b.id,
                'start_date': str(b.start_date),
                'end_date': str(b.end_date),
                'break_type': b.break_type or '',
                'status': b.status,
                'reason': b.reason or '',
                'notes': b.notes or '',
            } for b in breaks])
        except Exception:
            _logger.exception('API error in get_breaks')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/breaks/create', type='http', auth='user',
                methods=['POST'], csrf=False)
    def create_break(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record = request.env['sahyog.break.period'].sudo().create({
                'volunteer_id': volunteer.id,
                'break_type': data.get('break_type', 'personal'),
                'start_date': data['start_date'],
                'end_date': data['end_date'],
                'reason': data.get('reason', ''),
                'notes': data.get('notes', ''),
                'status': 'pending_admin',
                'created_by': request.env.uid,
            })
            return self._json_success({'id': record.id})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in create_break')
            return self._json_error('Internal server error', status=500)

    # ── Programs ────────────────────────────────────────────────────────

    @http.route('/sahyog/api/programs', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_programs(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            enrollments = request.env['sahyog.volunteer.program'].sudo().search(
                [('volunteer_id', '=', volunteer.id)], order='start_date desc',
            )
            return self._json_success([{
                'id': e.id,
                'program_name': e.program_id.name or '',
                'participation_type': e.participation_type or '',
                'start_date': str(e.start_date),
                'end_date': str(e.end_date),
                'location': e.location or '',
                'completion_status': e.completion_status,
                'notes': e.notes or '',
            } for e in enrollments])
        except Exception:
            _logger.exception('API error in get_programs')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/programs/available', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_available_programs(self, **kw):
        try:
            programs = request.env['sahyog.program'].sudo().search([])
            return self._json_success([{
                'id': p.id,
                'name': p.name or '',
                'description': p.description or '',
                'typical_duration_days': p.typical_duration_days or 0,
                'gender': p.gender or None,
                'program_type': p.program_type or '',
            } for p in programs])
        except Exception:
            _logger.exception('API error in get_available_programs')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/programs/create', type='http', auth='user',
                methods=['POST'], csrf=False)
    def create_program_enrollment(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record = request.env['sahyog.volunteer.program'].sudo().create({
                'volunteer_id': volunteer.id,
                'program_id': int(data['program_id']),
                'participation_type': data.get('participation_type', 'participant'),
                'start_date': data['start_date'],
                'end_date': data['end_date'],
                'location': data.get('location', ''),
                'notes': data.get('notes', ''),
                'completion_status': 'pending_admin',
                'created_by': request.env.uid,
            })
            return self._json_success({'id': record.id})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in create_program_enrollment')
            return self._json_error('Internal server error', status=500)

    # ── Notifications ───────────────────────────────────────────────────

    @http.route('/sahyog/api/notifications', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_notifications(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            notifications = request.env['sahyog.notification'].sudo().search(
                [('volunteer_id', '=', volunteer.id)], order='create_date desc',
            )
            return self._json_success([{
                'id': n.id,
                'type': n.type or '',
                'title': n.title or '',
                'message': n.message or '',
                'is_read': n.is_read,
                'create_date': str(n.create_date) if n.create_date else '',
            } for n in notifications])
        except Exception:
            _logger.exception('API error in get_notifications')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/notifications/unread-count', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_unread_count(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            count = request.env['sahyog.notification'].sudo().search_count([
                ('volunteer_id', '=', volunteer.id),
                ('is_read', '=', False),
            ])
            return self._json_success({'count': count})
        except Exception:
            _logger.exception('API error in get_unread_count')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/notifications/read', type='http', auth='user',
                methods=['POST'], csrf=False)
    def mark_notification_read(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            notif_id = int(data.get('notification_id', 0))
            notif = request.env['sahyog.notification'].sudo().browse(notif_id)
            if not notif.exists():
                return self._json_error('Notification not found')
            if notif.volunteer_id.id != volunteer.id:
                return self._json_error('Access denied', status=403)

            notif.write({'is_read': True})
            return self._json_success({'success': True})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in mark_notification_read')
            return self._json_error('Internal server error', status=500)

    # ── Unavailability ──────────────────────────────────────────────────

    @http.route('/sahyog/api/unavailability', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_unavailability(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            slots = request.env['sahyog.unavailability.slot'].sudo().search(
                [('volunteer_id', '=', volunteer.id)], order='date desc',
            )
            return self._json_success([{
                'id': s.id,
                'date': str(s.date),
                'start_time': s.start_time or '',
                'end_time': s.end_time or '',
                'reason': s.reason or '',
            } for s in slots])
        except Exception:
            _logger.exception('API error in get_unavailability')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/unavailability/create', type='http', auth='user',
                methods=['POST'], csrf=False)
    def create_unavailability(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record = request.env['sahyog.unavailability.slot'].sudo().create({
                'volunteer_id': volunteer.id,
                'date': data['date'],
                'start_time': data['start_time'],
                'end_time': data['end_time'],
                'reason': data.get('reason', ''),
            })
            return self._json_success({'id': record.id})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in create_unavailability')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/unavailability/delete', type='http', auth='user',
                methods=['POST'], csrf=False)
    def delete_unavailability(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            slot_id = int(data.get('slot_id', 0))
            slot = request.env['sahyog.unavailability.slot'].sudo().browse(slot_id)
            if not slot.exists():
                return self._json_error('Unavailability slot not found')
            if slot.volunteer_id.id != volunteer.id:
                return self._json_error('Access denied', status=403)

            slot.unlink()
            return self._json_success({'success': True})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in delete_unavailability')
            return self._json_error('Internal server error', status=500)

    # ── Volunteer Types ─────────────────────────────────────────────────

    @http.route('/sahyog/api/volunteer-types', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_volunteer_types(self, **kw):
        try:
            types = request.env['sahyog.volunteer.type'].sudo().search([])
            return self._json_success([{'id': t.id, 'name': t.name} for t in types])
        except Exception:
            _logger.exception('API error in get_volunteer_types')
            return self._json_error('Internal server error', status=500)

    # ── Cancel Endpoints ────────────────────────────────────────────────

    @http.route('/sahyog/api/silence/cancel', type='http', auth='user',
                methods=['POST'], csrf=False)
    def cancel_silence(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record_id = int(data.get('id', 0))
            record = request.env['sahyog.silence.period'].sudo().browse(record_id)
            if not record.exists():
                return self._json_error('Silence period not found')
            if record.volunteer_id.id != volunteer.id:
                return self._json_error('Access denied', status=403)

            record.write({'status': 'cancelled'})
            return self._json_success({'success': True})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in cancel_silence')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/breaks/cancel', type='http', auth='user',
                methods=['POST'], csrf=False)
    def cancel_break(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record_id = int(data.get('id', 0))
            record = request.env['sahyog.break.period'].sudo().browse(record_id)
            if not record.exists():
                return self._json_error('Break period not found')
            if record.volunteer_id.id != volunteer.id:
                return self._json_error('Access denied', status=403)

            record.write({'status': 'cancelled'})
            return self._json_success({'success': True})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in cancel_break')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/programs/cancel', type='http', auth='user',
                methods=['POST'], csrf=False)
    def cancel_program(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record_id = int(data.get('id', 0))
            record = request.env['sahyog.volunteer.program'].sudo().browse(record_id)
            if not record.exists():
                return self._json_error('Program enrollment not found')
            if record.volunteer_id.id != volunteer.id:
                return self._json_error('Access denied', status=403)

            record.write({'completion_status': 'dropped'})
            return self._json_success({'success': True})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in cancel_program')
            return self._json_error('Internal server error', status=500)

    # ── Volunteer Accept/Reject (for pending_volunteer entries) ─────────

    def _volunteer_respond(self, model, status_field, accept_value, reject_value, action, **kw):
        """Generic handler for volunteer accept/reject on pending_volunteer entries."""
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record_id = int(data.get('id', 0))
            record = request.env[model].sudo().browse(record_id)
            if not record.exists():
                return self._json_error('Record not found')
            if record.volunteer_id.id != volunteer.id:
                return self._json_error('Access denied', status=403)

            new_status = accept_value if action == 'accept' else reject_value
            record.write({status_field: new_status})
            return self._json_success({'success': True})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in volunteer_respond')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/silence/accept', type='http', auth='user',
                methods=['POST'], csrf=False)
    def accept_silence(self, **kw):
        return self._volunteer_respond(
            'sahyog.silence.period', 'status', 'approved', 'cancelled', 'accept', **kw)

    @http.route('/sahyog/api/silence/reject', type='http', auth='user',
                methods=['POST'], csrf=False)
    def reject_silence(self, **kw):
        return self._volunteer_respond(
            'sahyog.silence.period', 'status', 'approved', 'cancelled', 'reject', **kw)

    @http.route('/sahyog/api/breaks/accept', type='http', auth='user',
                methods=['POST'], csrf=False)
    def accept_break(self, **kw):
        return self._volunteer_respond(
            'sahyog.break.period', 'status', 'approved', 'cancelled', 'accept', **kw)

    @http.route('/sahyog/api/breaks/reject', type='http', auth='user',
                methods=['POST'], csrf=False)
    def reject_break(self, **kw):
        return self._volunteer_respond(
            'sahyog.break.period', 'status', 'approved', 'cancelled', 'reject', **kw)

    @http.route('/sahyog/api/programs/accept', type='http', auth='user',
                methods=['POST'], csrf=False)
    def accept_program(self, **kw):
        return self._volunteer_respond(
            'sahyog.volunteer.program', 'completion_status', 'upcoming', 'dropped', 'accept', **kw)

    @http.route('/sahyog/api/programs/reject', type='http', auth='user',
                methods=['POST'], csrf=False)
    def reject_program(self, **kw):
        return self._volunteer_respond(
            'sahyog.volunteer.program', 'completion_status', 'upcoming', 'dropped', 'reject', **kw)

    # ── Calendar ────────────────────────────────────────────────────────

    @http.route('/sahyog/api/calendar', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_calendar(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            date_start = kw.get('date_start')
            date_end = kw.get('date_end')

            domain = []
            if date_start:
                domain.append(('end_date', '>=', date_start))
            if date_end:
                domain.append(('start_date', '<=', date_end))

            entries = request.env['sahyog.calendar.entry'].sudo().search(domain)

            # Collect unique volunteers from entries
            volunteer_ids = list(set(e.volunteer_id.id for e in entries if e.volunteer_id))
            volunteers = request.env['hr.employee'].sudo().browse(volunteer_ids)

            return self._json_success({
                'volunteers': [{'id': v.id, 'name': v.name or '', 'volunteer_type_ids': [t.id for t in v.volunteer_type_ids]} for v in volunteers],
                'entries': [{
                    'id': e.id,
                    'volunteer_id': e.volunteer_id.id if e.volunteer_id else 0,
                    'entry_type': e.entry_type or '',
                    'name': e.name or '',
                    'start_date': str(e.start_date) if e.start_date else '',
                    'end_date': str(e.end_date) if e.end_date else '',
                    'status': e.status or '',
                } for e in entries],
            })
        except Exception:
            _logger.exception('API error in get_calendar')
            return self._json_error('Internal server error', status=500)
