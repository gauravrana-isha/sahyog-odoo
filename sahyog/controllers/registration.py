import logging

from odoo import http, fields
from odoo.http import request

_logger = logging.getLogger(__name__)


class SahyogRegistration(http.Controller):

    @http.route('/sahyog/register/<string:token>', type='http', auth='public', website=True)
    def registration_form(self, token, **kw):
        """Validate token and show registration form or error page."""
        link = request.env['sahyog.registration.link'].sudo().search(
            [('token', '=', token)], limit=1,
        )
        if not link:
            return request.render('sahyog.registration_error', {
                'error_message': 'Invalid registration link.',
            })
        # Auto-expire if past expiration
        link._check_and_expire()
        if link.status != 'active':
            status_msg = {
                'used': 'This registration link has already been used.',
                'expired': 'This registration link has expired.',
            }
            return request.render('sahyog.registration_error', {
                'error_message': status_msg.get(link.status, 'This registration link is no longer valid.'),
            })
        return request.render('sahyog.registration_form', {
            'token': token,
            'error': kw.get('error'),
        })

    @http.route('/sahyog/register/submit', type='http', auth='public', website=True, methods=['POST'])
    def registration_submit(self, **kw):
        """Process registration form: create hr.employee + res.users, mark link as Used."""
        token = kw.get('token', '')
        link = request.env['sahyog.registration.link'].sudo().search(
            [('token', '=', token)], limit=1,
        )
        if not link:
            return request.render('sahyog.registration_error', {
                'error_message': 'Invalid registration link.',
            })
        link._check_and_expire()
        if link.status != 'active':
            return request.render('sahyog.registration_error', {
                'error_message': 'This registration link is no longer valid.',
            })

        name = (kw.get('name') or '').strip()
        email = (kw.get('email') or '').strip()
        phone = (kw.get('phone') or '').strip()
        whatsapp = (kw.get('whatsapp_number') or '').strip()

        if not name or not email:
            return request.redirect(
                '/sahyog/register/%s?error=Name and email are required.' % token
            )

        try:
            # Create res.users account (portal user)
            portal_group = request.env.ref('base.group_portal')
            user = request.env['res.users'].sudo().create({
                'name': name,
                'login': email,
                'email': email,
                'group_ids': [(6, 0, [portal_group.id])],
            })

            # Create hr.employee linked to the user
            employee = request.env['hr.employee'].sudo().create({
                'name': name,
                'work_email': email,
                'phone': phone,
                'whatsapp_number': whatsapp,
                'user_id': user.id,
            })

            # Mark link as used
            link.sudo().write({
                'status': 'used',
                'used_by_volunteer_id': employee.id,
            })

            return request.render('sahyog.registration_success', {
                'volunteer_name': name,
            })

        except Exception as e:
            _logger.exception("Registration failed for token %s", token)
            return request.redirect(
                '/sahyog/register/%s?error=%s' % (token, str(e))
            )
