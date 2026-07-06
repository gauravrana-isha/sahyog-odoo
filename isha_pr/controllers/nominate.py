"""Public nomination form (/pr/nominate).

Mirrors the sahyog guest-feedback pattern: public QWeb page + plain HTML
form POST with server-side validation. A submission find-or-creates the
nominee res.partner (flagged is_pr_contact) and creates a pr.nomination
carrying everything the nominator declared; research/tiering fields are
filled later by coordinators / AI enrichment.
"""

import logging
from datetime import date

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)

REQUIRED_FIELDS = (
    ('nominator_first', 'Your first name is required.'),
    ('nominator_email', 'Your email address is required.'),
    ('nominator_phone', 'Your phone number is required.'),
    ('is_self_nomination', 'Please indicate whether this is a self-nomination.'),
    ('proceed_preference', 'Please choose how you would prefer to proceed.'),
    ('nominee_first', "The nominee's first name is required."),
    ('social_links', 'Please share at least one website or social media link.'),
    ('ie_completed', 'Please indicate whether the nominee has completed Inner Engineering.'),
)


class PRNominatePublic(http.Controller):

    def _render_ctx(self, values=None, error=None):
        countries = request.env['res.country'].sudo().search([]).mapped('name')
        codes = request.env['res.country'].sudo().search([('phone_code', '!=', 0)]).mapped('phone_code')
        phone_codes = sorted({str(c) for c in codes}, key=lambda x: (x != '1', int(x)))
        return {
            'countries': countries,
            'phone_codes': phone_codes,
            'values': values or {},
            'error': error,
        }

    @http.route('/pr/nominate', type='http', auth='public', csrf=False)
    def nominate_form(self, **kw):
        return request.render('isha_pr.pr_nomination_form', self._render_ctx())

    @http.route('/pr/nominate/submit', type='http', auth='public', csrf=False,
                methods=['POST'])
    def nominate_submit(self, **kw):
        form = request.httprequest.form
        values = {k: (form.get(k) or '').strip() for k in (
            'nominator_first', 'nominator_last', 'nominator_email',
            'nominator_country_code', 'nominator_phone',
            'nominator_city', 'nominator_state', 'nominator_country',
            'is_self_nomination', 'proceed_preference',
            'nominee_first', 'nominee_last', 'social_links', 'ie_completed',
            'nominee_country_code', 'nominee_phone', 'nominee_email',
            'influence_examples',
        )}
        values['nominated_for_list'] = form.getlist('nominated_for')

        for field, message in REQUIRED_FIELDS:
            if not values.get(field):
                return request.render('isha_pr.pr_nomination_form',
                                      self._render_ctx(values, error=message))
        if not values['nominated_for_list']:
            return request.render('isha_pr.pr_nomination_form',
                                  self._render_ctx(values, error='Please select at least one offering.'))

        try:
            nominee_name = ' '.join(x for x in (values['nominee_first'], values['nominee_last']) if x)
            nominee_email = values['nominee_email']
            nominee_phone = (f"+{values['nominee_country_code']} {values['nominee_phone']}"
                             if values['nominee_phone'] else '')

            # Find-or-create the shared person (same matching as contacts/create)
            Partner = request.env['res.partner'].sudo()
            partner = Partner.browse()
            if nominee_email:
                partner = Partner.search([('email', '=ilike', nominee_email)], limit=1)
            if not partner and nominee_phone:
                partner = Partner.search([('phone', '=', nominee_phone)], limit=1)
            if not partner:
                partner = Partner.create({
                    'name': nominee_name,
                    'email': nominee_email,
                    'phone': nominee_phone,
                    'is_pr_contact': True,
                })
            else:
                partner.write({'is_pr_contact': True})

            nomination = request.env['pr.nomination'].sudo().create({
                'nominee_id': partner.id,
                'nominator_name': ' '.join(x for x in (values['nominator_first'], values['nominator_last']) if x),
                'nominator_email': values['nominator_email'],
                'nominator_phone': (f"+{values['nominator_country_code']} {values['nominator_phone']}"
                                    if values['nominator_phone'] else ''),
                'nominator_city': values['nominator_city'],
                'nominator_state': values['nominator_state'],
                'nominator_country': values['nominator_country'],
                'is_self_nomination': values['is_self_nomination'] == 'yes',
                'nominated_for': ', '.join(values['nominated_for_list']),
                'proceed_preference': values['proceed_preference'],
                'social_links': values['social_links'],
                'ie_or_shambhavi': values['ie_completed'],
                'influence_examples': values['influence_examples'],
                'submission_date': date.today(),
                'source_tab': 'web_form',
            })

            # Tell the PR admins a new nomination arrived for review.
            admins = request.env.ref('isha_pr.group_isha_pr_admin').sudo().users
            request.env['pr.notification'].sudo().notify(
                admins, 'nomination_new', 'New nomination received',
                f'{nominee_name} — nominated by {values["nominator_first"]} {values["nominator_last"]}'.strip(),
                path=f'/nominations/{nomination.id}',
            )
        except Exception:
            _logger.exception('PR nomination submission failed')
            return request.render('isha_pr.pr_nomination_form', self._render_ctx(
                values, error='Something went wrong while submitting. Please try again.'))

        return request.render('isha_pr.pr_nomination_thanks', {})
