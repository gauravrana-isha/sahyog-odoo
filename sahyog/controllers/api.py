import json
import logging

from odoo import http, fields
from odoo.http import request
from odoo.exceptions import ValidationError
from odoo.addons.sahyog.models import silence_rules

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
                'emergency_contact_relation', 'x_city', 'x_state', 'x_nationality',
            )
            vals = {k: data[k] for k in editable_fields if k in data}
            # Handle Many2many fields: language_ids, volunteer_type_ids
            if 'language_ids' in data:
                vals['language_ids'] = [(6, 0, [int(i) for i in data['language_ids']])]
            if 'volunteer_type_ids' in data:
                vals['volunteer_type_ids'] = [(6, 0, [int(i) for i in data['volunteer_type_ids']])]
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
                'is_recurring': s.is_recurring,
                'start_time': s.start_time or '',
                'end_time': s.end_time or '',
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
            vals = {
                'volunteer_id': volunteer.id,
                'start_date': data['start_date'],
                'end_date': data['end_date'],
                'silence_type': data.get('silence_type', 'personal'),
                'notes': data.get('notes', ''),
                'status': 'pending_admin',
                'created_by': request.env.uid,
                'is_recurring': data.get('is_recurring', False),
                'start_time': data.get('start_time', ''),
                'end_time': data.get('end_time', ''),
            }
            if data.get('program_id'):
                vals['program_id'] = int(data['program_id'])
            record = request.env['sahyog.silence.period'].sudo().create(vals)

            # Advisory silence limit warning
            warning = None
            try:
                start_date = fields.Date.from_string(data['start_date'])
                year = start_date.year
                annual_total = silence_rules.calculate_annual_silence_days(
                    request.env.sudo(), volunteer.id, year,
                )
                _min_days, max_days = silence_rules.get_volunteer_limits(volunteer)
                if max_days is not None and annual_total > max_days:
                    warning = (
                        'Annual silence days (%d) exceed maximum (%d) for your volunteer type.'
                        % (annual_total, max_days)
                    )
            except Exception:
                _logger.exception('Error calculating silence limit warning')

            return self._json_success({'id': record.id, 'warning': warning})
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
                'is_recurring': b.is_recurring,
                'start_time': b.start_time or '',
                'end_time': b.end_time or '',
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

    @http.route('/sahyog/api/programs/suggested', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_suggested_programs(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            # Completed program IDs (done enrollments)
            completed_enrollments = request.env['sahyog.volunteer.program'].sudo().search([
                ('volunteer_id', '=', volunteer.id),
                ('completion_status', '=', 'done'),
            ])
            completed_program_ids = set(completed_enrollments.mapped('program_id.id'))

            # Current enrollment program IDs (any non-dropped enrollment)
            current_enrollments = request.env['sahyog.volunteer.program'].sudo().search([
                ('volunteer_id', '=', volunteer.id),
                ('completion_status', 'not in', ['dropped']),
            ])
            current_program_ids = set(current_enrollments.mapped('program_id.id'))

            # All programs
            all_programs = request.env['sahyog.program'].sudo().search([])

            suggested = []
            for prog in all_programs:
                # (b) Exclude programs the volunteer is already enrolled in
                if prog.id in current_program_ids:
                    continue
                # (a) All prerequisites must be in the completed set
                if not all(pid in completed_program_ids for pid in prog.prerequisite_ids.ids):
                    continue
                # (c) Gender restriction must match volunteer's sex (or no restriction)
                if prog.gender and prog.gender != volunteer.sex:
                    continue
                suggested.append({
                    'id': prog.id,
                    'name': prog.name or '',
                    'description': prog.description or '',
                    'typical_duration_days': prog.typical_duration_days or 0,
                    'gender': prog.gender or None,
                    'program_type': prog.program_type or '',
                    'prerequisite_ids': [{'id': p.id, 'name': p.name} for p in prog.prerequisite_ids],
                })

            return self._json_success(suggested)
        except Exception:
            _logger.exception('API error in get_suggested_programs')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/schedules/upcoming', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_all_upcoming_schedules(self, **kw):
        try:
            volunteer = self._get_volunteer()

            # Only show main and hatha program types
            eligible_programs = request.env['sahyog.program'].sudo().search([
                ('program_type', 'in', ('main', 'hatha')),
            ])
            eligible_program_ids = eligible_programs.ids

            # Exclude programs the volunteer has already completed (fuzzy: strip language suffix)
            completed_program_ids = set()
            completed_base_names = set()
            if volunteer:
                completed_enrollments = request.env['sahyog.volunteer.program'].sudo().search([
                    ('volunteer_id', '=', volunteer.id),
                    ('completion_status', '=', 'done'),
                ])
                completed_program_ids = set(completed_enrollments.mapped('program_id.id'))
                # Also collect base names (strip parenthesized suffix) for fuzzy matching
                import re
                for enr in completed_enrollments:
                    pname = enr.program_id.name or ''
                    base = re.sub(r'\s*\([^)]*\)\s*$', '', pname).strip().lower()
                    if base:
                        completed_base_names.add(base)

            # Also exclude prerequisites of completed programs
            completed_prereq_ids = set()
            if completed_program_ids:
                for prog in request.env['sahyog.program'].sudo().browse(list(completed_program_ids)):
                    completed_prereq_ids.update(prog.prerequisite_ids.ids)

            schedules = request.env['sahyog.program.schedule'].sudo().search([
                ('schedule_status', '=', 'upcoming'),
                ('program_id', 'in', eligible_program_ids),
            ], order='start_date asc')

            result = []
            for s in schedules:
                pid = s.program_id.id
                pname = s.program_id.name or ''
                # Skip if exact program completed
                if pid in completed_program_ids:
                    continue
                # Skip if base name matches a completed program (fuzzy: prefix match)
                import re as _re
                base = _re.sub(r'\s*\([^)]*\)\s*$', '', pname).strip().lower()
                if any(base.startswith(cb) or cb.startswith(base) for cb in completed_base_names):
                    continue
                # Skip prerequisites of completed programs
                if pid in completed_prereq_ids:
                    continue
                # Skip programs with gender restriction that doesn't match volunteer
                prog_gender = s.program_id.gender
                if volunteer and prog_gender and prog_gender != volunteer.sex:
                    continue
                result.append({
                    'id': s.id,
                    'program_id': s.program_id.id,
                    'program_name': s.program_id.name or '',
                    'program_type': s.program_id.program_type or '',
                    'start_date': str(s.start_date),
                    'end_date': str(s.end_date),
                    'start_time': s.start_time or '',
                    'end_time': s.end_time or '',
                    'is_recurring': s.is_recurring,
                    'location': s.location or '',
                    'capacity': s.capacity or 0,
                    'fee': s.fee or '',
                    'schedule_status': s.schedule_status or '',
                    'notes': s.notes or '',
                })
            return self._json_success(result)
        except Exception:
            _logger.exception('API error in get_all_upcoming_schedules')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/programs/<int:program_id>/schedules', type='http',
                auth='user', methods=['GET'], csrf=False)
    def get_program_schedules(self, program_id, **kw):
        try:
            schedules = request.env['sahyog.program.schedule'].sudo().search([
                ('program_id', '=', program_id),
                ('schedule_status', '=', 'upcoming'),
            ])
            return self._json_success([{
                'id': s.id,
                'program_id': s.program_id.id,
                'start_date': str(s.start_date),
                'end_date': str(s.end_date),
                'start_time': s.start_time or '',
                'end_time': s.end_time or '',
                'is_recurring': s.is_recurring,
                'location': s.location or '',
                'capacity': s.capacity or 0,
                'schedule_status': s.schedule_status or '',
            } for s in schedules])
        except Exception:
            _logger.exception('API error in get_program_schedules')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/programs/create', type='http', auth='user',
                methods=['POST'], csrf=False)
    def create_program_enrollment(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            vals = {
                'volunteer_id': volunteer.id,
                'program_id': int(data['program_id']),
                'participation_type': data.get('participation_type', 'participant'),
                'start_date': data['start_date'],
                'end_date': data['end_date'],
                'location': data.get('location', ''),
                'notes': data.get('notes', ''),
                'completion_status': 'pending_admin',
                'created_by': request.env.uid,
            }
            if data.get('schedule_id'):
                vals['schedule_id'] = int(data['schedule_id'])
            record = request.env['sahyog.volunteer.program'].sudo().create(vals)
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

    @http.route('/sahyog/api/languages', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_languages(self, **kw):
        try:
            langs = request.env['sahyog.language'].sudo().search([])
            return self._json_success([{'id': l.id, 'name': l.name} for l in langs])
        except Exception:
            _logger.exception('API error in get_languages')
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

    # ── Meetings ────────────────────────────────────────────────────────

    @http.route('/sahyog/api/meetings', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_meetings(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            meetings = request.env['sahyog.meeting'].sudo().search([
                '|',
                ('volunteer_id', '=', volunteer.id),
                ('meeting_with_id', '=', volunteer.id),
            ], order='date desc')

            return self._json_success([{
                'id': m.id,
                'title': m.title or '',
                'volunteer_id': self._m2o(m, 'volunteer_id'),
                'meeting_with_id': self._m2o(m, 'meeting_with_id'),
                'date': str(m.date) if m.date else '',
                'start_time': m.start_time or '',
                'end_time': m.end_time or '',
                'location': m.location or '',
                'notes': m.notes or '',
                'status': m.status or '',
            } for m in meetings])
        except Exception:
            _logger.exception('API error in get_meetings')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/meetings/<int:meeting_id>', type='http', auth='user',
                methods=['GET'], csrf=False)
    def get_meeting_detail(self, meeting_id, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            meeting = request.env['sahyog.meeting'].sudo().browse(meeting_id)
            if not meeting.exists():
                return self._json_error('Meeting not found')
            if meeting.volunteer_id.id != volunteer.id and meeting.meeting_with_id.id != volunteer.id:
                return self._json_error('Access denied', status=403)

            return self._json_success({
                'id': meeting.id,
                'title': meeting.title or '',
                'volunteer_id': self._m2o(meeting, 'volunteer_id'),
                'meeting_with_id': self._m2o(meeting, 'meeting_with_id'),
                'date': str(meeting.date) if meeting.date else '',
                'start_time': meeting.start_time or '',
                'end_time': meeting.end_time or '',
                'location': meeting.location or '',
                'notes': meeting.notes or '',
                'status': meeting.status or '',
            })
        except Exception:
            _logger.exception('API error in get_meeting_detail')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/meetings/create', type='http', auth='user',
                methods=['POST'], csrf=False)
    def create_meeting(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record = request.env['sahyog.meeting'].sudo().create({
                'title': data['title'],
                'volunteer_id': volunteer.id,
                'meeting_with_id': int(data['meeting_with_id']),
                'date': data['date'],
                'start_time': data['start_time'],
                'end_time': data['end_time'],
                'location': data.get('location', ''),
                'notes': data.get('notes', ''),
                'created_by': request.env.uid,
            })

            # ── Conflict detection for both participants ──
            warnings = []
            meeting_date = data['date']
            meeting_start = data['start_time']
            meeting_end = data['end_time']
            participant_ids = [volunteer.id, int(data['meeting_with_id'])]

            ACTIVE_STATUSES = ('approved', 'on_going', 'upcoming')

            for pid in participant_ids:
                participant = request.env['hr.employee'].sudo().browse(pid)
                pname = participant.name or 'Unknown'

                # Check silence periods
                silences = request.env['sahyog.silence.period'].sudo().search([
                    ('volunteer_id', '=', pid),
                    ('status', 'in', ACTIVE_STATUSES),
                    ('start_date', '<=', meeting_date),
                    ('end_date', '>=', meeting_date),
                ])
                for s in silences:
                    warnings.append(
                        'Conflict: %s has an active silence period (%s → %s) on %s.' %
                        (pname, s.start_date, s.end_date, meeting_date)
                    )

                # Check break periods
                breaks = request.env['sahyog.break.period'].sudo().search([
                    ('volunteer_id', '=', pid),
                    ('status', 'in', ACTIVE_STATUSES),
                    ('start_date', '<=', meeting_date),
                    ('end_date', '>=', meeting_date),
                ])
                for b in breaks:
                    warnings.append(
                        'Conflict: %s has an active break period (%s → %s) on %s.' %
                        (pname, b.start_date, b.end_date, meeting_date)
                    )

                # Check program periods
                programs = request.env['sahyog.volunteer.program'].sudo().search([
                    ('volunteer_id', '=', pid),
                    ('completion_status', 'in', ACTIVE_STATUSES),
                    ('start_date', '<=', meeting_date),
                    ('end_date', '>=', meeting_date),
                ])
                for p in programs:
                    warnings.append(
                        'Conflict: %s has an active program (%s) on %s.' %
                        (pname, p.program_id.name or '', meeting_date)
                    )

                # Check unavailability slot time overlap
                slots = request.env['sahyog.unavailability.slot'].sudo().search([
                    ('volunteer_id', '=', pid),
                    ('date', '=', meeting_date),
                ])
                for slot in slots:
                    if slot.start_time < meeting_end and meeting_start < slot.end_time:
                        warnings.append(
                            'Conflict: %s is unavailable on %s from %s to %s.' %
                            (pname, meeting_date, slot.start_time, slot.end_time)
                        )

            return self._json_success({'id': record.id, 'warnings': warnings})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in create_meeting')
            return self._json_error('Internal server error', status=500)

    @http.route('/sahyog/api/meetings/cancel', type='http', auth='user',
                methods=['POST'], csrf=False)
    def cancel_meeting(self, **kw):
        try:
            volunteer = self._get_volunteer()
            if not volunteer:
                return self._json_error('No volunteer record linked to your account')

            data = self._parse_json()
            record_id = int(data.get('id', 0))
            record = request.env['sahyog.meeting'].sudo().browse(record_id)
            if not record.exists():
                return self._json_error('Meeting not found')
            if record.volunteer_id.id != volunteer.id and record.meeting_with_id.id != volunteer.id:
                return self._json_error('Access denied', status=403)

            record.write({'status': 'cancelled'})
            return self._json_success({'success': True})
        except ValidationError as e:
            return self._json_error(str(e))
        except Exception:
            _logger.exception('API error in cancel_meeting')
            return self._json_error('Internal server error', status=500)

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
