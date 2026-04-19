import logging
from datetime import datetime

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


class GuestFeedbackPublic(http.Controller):

    @http.route('/sahyog/guest-feedback/<string:token>', type='http',
                auth='public', csrf=False, website=True)
    def feedback_form(self, token, **kw):
        """Validate token and render the public feedback form."""
        visit = request.env['sahyog.guest.visit'].sudo().search(
            [('qr_token', '=', token)], limit=1,
        )
        if not visit:
            return request.render('sahyog.sahyog_guest_feedback_error', {
                'error_message': 'Invalid feedback link.',
            })

        # Check expiry
        if visit.qr_expiry and datetime.now() > visit.qr_expiry:
            return request.render('sahyog.sahyog_guest_feedback_expired', {
                'visit': visit,
            })

        return request.render('sahyog.sahyog_guest_feedback_form', {
            'visit': visit,
            'token': token,
        })

    @http.route('/sahyog/guest-feedback/<string:token>/submit', type='http',
                auth='public', csrf=False, website=True, methods=['POST'])
    def feedback_submit(self, token, **kw):
        """Process the feedback form submission and create a Guest Feedback record."""
        visit = request.env['sahyog.guest.visit'].sudo().search(
            [('qr_token', '=', token)], limit=1,
        )
        if not visit:
            return request.render('sahyog.sahyog_guest_feedback_error', {
                'error_message': 'Invalid feedback link.',
            })

        # Check expiry
        if visit.qr_expiry and datetime.now() > visit.qr_expiry:
            return request.render('sahyog.sahyog_guest_feedback_expired', {
                'visit': visit,
            })

        # Parse form data from regular HTML form POST
        form = request.httprequest.form
        guest_name = (form.get('guest_name') or '').strip()
        if not guest_name:
            return request.render('sahyog.sahyog_guest_feedback_form', {
                'visit': visit,
                'token': token,
                'error': 'Guest name is required.',
            })

        overall_rating = form.get('overall_rating') or ''
        if not overall_rating:
            return request.render('sahyog.sahyog_guest_feedback_form', {
                'visit': visit,
                'token': token,
                'error': 'Overall rating is required.',
            })

        try:
            request.env['sahyog.guest.feedback'].sudo().create({
                'visit_id': visit.id,
                'guest_name': guest_name,
                'contact_phone': (form.get('contact_phone') or '').strip(),
                'contact_email': (form.get('contact_email') or '').strip(),
                'overall_rating': overall_rating,
                'enjoyed_most': (form.get('enjoyed_most') or '').strip(),
                'could_be_improved': (form.get('could_be_improved') or '').strip(),
                'interested_in_programs': bool(form.get('interested_in_programs')),
                'want_to_know_initiatives': bool(form.get('want_to_know_initiatives')),
                'would_visit_again': form.get('would_visit_again') or False,
                'additional_comments': (form.get('additional_comments') or '').strip(),
            })
        except Exception:
            _logger.exception('Failed to create guest feedback for token %s', token)
            return request.render('sahyog.sahyog_guest_feedback_error', {
                'error_message': 'An error occurred while submitting your feedback. Please try again.',
            })

        return request.render('sahyog.sahyog_guest_feedback_thanks', {
            'visit': visit,
        })
