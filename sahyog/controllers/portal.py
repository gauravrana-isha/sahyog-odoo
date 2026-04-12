import logging

from odoo import http, fields, _
from odoo.http import request
from odoo.addons.portal.controllers.portal import CustomerPortal

_logger = logging.getLogger(__name__)


class SahyogPortal(CustomerPortal):

    # ── Helper ──────────────────────────────────────────────────────────
    def _get_volunteer(self):
        """Return the hr.employee linked to the current portal user."""
        return request.env['hr.employee'].sudo().search(
            [('user_id', '=', request.env.uid)], limit=1,
        )

    # ── Portal Home Counters (disabled — SPA replaces portal) ──────────
    def _prepare_home_portal_values(self, counters):
        return super()._prepare_home_portal_values(counters)

    # ── Portal Dashboard ────────────────────────────────────────────────
    @http.route('/my/sahyog', type='http', auth='user', website=True)
    def portal_dashboard(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        today = fields.Date.context_today(request.env['hr.employee'])
        completed_programs = request.env['sahyog.volunteer.program'].sudo().search_count(
            [('volunteer_id', '=', volunteer.id), ('completion_status', '=', 'done')],
        )
        upcoming_silences = request.env['sahyog.silence.period'].sudo().search(
            [('volunteer_id', '=', volunteer.id),
             ('end_date', '>=', today),
             ('status', 'in', ('approved', 'on_going'))],
            order='start_date asc',
        )
        upcoming_breaks = request.env['sahyog.break.period'].sudo().search(
            [('volunteer_id', '=', volunteer.id),
             ('end_date', '>=', today),
             ('status', 'in', ('approved', 'on_going'))],
            order='start_date asc',
        )
        upcoming_programs = request.env['sahyog.volunteer.program'].sudo().search(
            [('volunteer_id', '=', volunteer.id),
             ('end_date', '>=', today),
             ('completion_status', '=', 'upcoming')],
            order='start_date asc',
        )
        return request.render('sahyog.portal_my_dashboard', {
            'volunteer': volunteer,
            'completed_programs': completed_programs,
            'upcoming_silences': upcoming_silences,
            'upcoming_breaks': upcoming_breaks,
            'upcoming_programs': upcoming_programs,
            'page_name': 'sahyog_dashboard',
        })

    # ── Profile ─────────────────────────────────────────────────────────
    @http.route('/my/sahyog/profile', type='http', auth='user', website=True)
    def portal_profile(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        error = kw.get('error')
        success = kw.get('success')
        if request.httprequest.method == 'POST':
            vals = {}
            for fname in ('phone', 'whatsapp_number', 'emergency_contact_name',
                          'emergency_contact_phone', 'emergency_contact_relation',
                          'special_skills', 'health_conditions'):
                if fname in kw:
                    vals[fname] = kw[fname]
            if vals:
                volunteer.sudo().write(vals)
            return request.redirect('/my/sahyog/profile?success=1')
        return request.render('sahyog.portal_my_profile', {
            'volunteer': volunteer,
            'page_name': 'sahyog_profile',
            'error': error,
            'success': success,
        })

    # ── Silence Periods ─────────────────────────────────────────────────
    @http.route('/my/sahyog/silence', type='http', auth='user', website=True)
    def portal_silence_list(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        silences = request.env['sahyog.silence.period'].sudo().search(
            [('volunteer_id', '=', volunteer.id)], order='start_date desc',
        )
        return request.render('sahyog.portal_my_silence', {
            'silences': silences,
            'page_name': 'sahyog_silence',
        })

    @http.route('/my/sahyog/silence/request', type='http', auth='user', website=True)
    def portal_silence_request(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        if request.httprequest.method == 'POST':
            try:
                request.env['sahyog.silence.period'].sudo().create({
                    'volunteer_id': volunteer.id,
                    'start_date': kw.get('start_date'),
                    'end_date': kw.get('end_date'),
                    'silence_type': kw.get('silence_type', 'personal'),
                    'notes': kw.get('notes', ''),
                    'status': 'pending_admin',
                    'created_by': request.env.uid,
                })
                return request.redirect('/my/sahyog/silence?success=1')
            except Exception as e:
                _logger.exception("Portal silence request failed")
                return request.redirect('/my/sahyog/silence/request?error=%s' % str(e))
        return request.render('sahyog.portal_silence_request', {
            'page_name': 'sahyog_silence_request',
            'error': kw.get('error'),
        })

    # ── Break Periods ───────────────────────────────────────────────────
    @http.route('/my/sahyog/breaks', type='http', auth='user', website=True)
    def portal_breaks_list(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        breaks = request.env['sahyog.break.period'].sudo().search(
            [('volunteer_id', '=', volunteer.id)], order='start_date desc',
        )
        return request.render('sahyog.portal_my_breaks', {
            'breaks': breaks,
            'page_name': 'sahyog_breaks',
        })

    @http.route('/my/sahyog/breaks/request', type='http', auth='user', website=True)
    def portal_break_request(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        if request.httprequest.method == 'POST':
            try:
                request.env['sahyog.break.period'].sudo().create({
                    'volunteer_id': volunteer.id,
                    'break_type': kw.get('break_type', 'personal'),
                    'start_date': kw.get('start_date'),
                    'end_date': kw.get('end_date'),
                    'reason': kw.get('reason', ''),
                    'notes': kw.get('notes', ''),
                    'status': 'pending_admin',
                    'created_by': request.env.uid,
                })
                return request.redirect('/my/sahyog/breaks?success=1')
            except Exception as e:
                _logger.exception("Portal break request failed")
                return request.redirect('/my/sahyog/breaks/request?error=%s' % str(e))
        return request.render('sahyog.portal_break_request', {
            'page_name': 'sahyog_break_request',
            'error': kw.get('error'),
        })

    # ── Programs ────────────────────────────────────────────────────────
    @http.route('/my/sahyog/programs', type='http', auth='user', website=True)
    def portal_programs_list(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        enrollments = request.env['sahyog.volunteer.program'].sudo().search(
            [('volunteer_id', '=', volunteer.id)], order='start_date desc',
        )
        return request.render('sahyog.portal_my_programs', {
            'enrollments': enrollments,
            'page_name': 'sahyog_programs',
        })

    @http.route('/my/sahyog/programs/request', type='http', auth='user', website=True)
    def portal_program_request(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        programs = request.env['sahyog.program'].sudo().search([])
        if request.httprequest.method == 'POST':
            try:
                request.env['sahyog.volunteer.program'].sudo().create({
                    'volunteer_id': volunteer.id,
                    'program_id': int(kw.get('program_id')),
                    'participation_type': kw.get('participation_type', 'participant'),
                    'start_date': kw.get('start_date'),
                    'end_date': kw.get('end_date'),
                    'location': kw.get('location', ''),
                    'notes': kw.get('notes', ''),
                    'completion_status': 'pending_admin',
                    'created_by': request.env.uid,
                })
                return request.redirect('/my/sahyog/programs?success=1')
            except Exception as e:
                _logger.exception("Portal program request failed")
                return request.redirect('/my/sahyog/programs/request?error=%s' % str(e))
        return request.render('sahyog.portal_program_request', {
            'programs': programs,
            'page_name': 'sahyog_program_request',
            'error': kw.get('error'),
        })

    # ── Notifications ───────────────────────────────────────────────────
    @http.route('/my/sahyog/notifications', type='http', auth='user', website=True)
    def portal_notifications(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        # Mark as read if requested
        mark_read_id = kw.get('mark_read')
        if mark_read_id:
            notif = request.env['sahyog.notification'].sudo().browse(int(mark_read_id))
            if notif.exists() and notif.volunteer_id.id == volunteer.id:
                notif.write({'is_read': True})
            return request.redirect('/my/sahyog/notifications')
        notifications = request.env['sahyog.notification'].sudo().search(
            [('volunteer_id', '=', volunteer.id)], order='create_date desc',
        )
        return request.render('sahyog.portal_my_notifications', {
            'notifications': notifications,
            'page_name': 'sahyog_notifications',
        })

    # ── Unavailability ──────────────────────────────────────────────────
    @http.route('/my/sahyog/unavailability', type='http', auth='user', website=True)
    def portal_unavailability(self, **kw):
        volunteer = self._get_volunteer()
        if not volunteer:
            return request.redirect('/my')
        # Delete if requested
        delete_id = kw.get('delete')
        if delete_id:
            slot = request.env['sahyog.unavailability.slot'].sudo().browse(int(delete_id))
            if slot.exists() and slot.volunteer_id.id == volunteer.id:
                slot.unlink()
            return request.redirect('/my/sahyog/unavailability')
        # Create if POST
        if request.httprequest.method == 'POST':
            try:
                request.env['sahyog.unavailability.slot'].sudo().create({
                    'volunteer_id': volunteer.id,
                    'date': kw.get('date'),
                    'start_time': kw.get('start_time'),
                    'end_time': kw.get('end_time'),
                    'reason': kw.get('reason', ''),
                })
                return request.redirect('/my/sahyog/unavailability?success=1')
            except Exception as e:
                _logger.exception("Portal unavailability create failed")
                return request.redirect('/my/sahyog/unavailability?error=%s' % str(e))
        slots = request.env['sahyog.unavailability.slot'].sudo().search(
            [('volunteer_id', '=', volunteer.id)], order='date desc',
        )
        return request.render('sahyog.portal_my_unavailability', {
            'slots': slots,
            'page_name': 'sahyog_unavailability',
            'error': kw.get('error'),
            'success': kw.get('success'),
        })
