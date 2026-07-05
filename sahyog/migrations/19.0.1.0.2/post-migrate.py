"""Backfill sahyog.guest.visit.partner_id (guest → shared res.partner).

Idempotent: only touches visits with no partner yet, and reuses the model's
find-or-create dedup so re-running (or new records) never duplicates people.
"""

import logging

from odoo import api, SUPERUSER_ID

_logger = logging.getLogger(__name__)


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    Visit = env['sahyog.guest.visit']
    visits = Visit.search([('partner_id', '=', False)])
    _logger.info('Backfilling partner_id for %s guest visit(s)', len(visits))
    for visit in visits:
        vals = {
            'main_guest_name': visit.main_guest_name,
            'email': visit.email,
            'phone': visit.phone,
        }
        visit.partner_id = Visit._find_or_create_partner(vals)
    _logger.info('Guest → partner backfill complete')
