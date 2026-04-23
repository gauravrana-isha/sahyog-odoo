"""
Google Sheets Integration via Apps Script Web App
==================================================

Setup Steps:
1. Deploy the Apps Script web app (Execute as: Me, Access: Anyone).
2. Set Odoo system parameter: sahyog.google_sheets_webapp_url = <web app URL>
"""

import logging
from datetime import datetime

import requests

_logger = logging.getLogger(__name__)

CENTER_FLAG_MAP = {
    'SSB Bangalore': 'SSB',
    'IYC Coimbatore': 'IYC',
}


def _get_region_flag(visit_record):
    center_name = visit_record.center_id.name if visit_record.center_id else ''
    if center_name in CENTER_FLAG_MAP:
        return CENTER_FLAG_MAP[center_name]
    return visit_record.region_id.name if visit_record.region_id else ''


def _get_selection_label(record, field_name):
    val = record[field_name]
    if not val:
        return ''
    selection = dict(record._fields[field_name].selection)
    return selection.get(val, val)


def _generate_uid():
    now = datetime.now()
    return 'GUEST-%s-%s' % (
        now.strftime('%Y%m%d'),
        now.strftime('%H%M%S') + '%03d' % (now.microsecond // 1000),
    )


def _build_places_string(v):
    places = ', '.join(v.place_event_ids.mapped('name')) if v.place_event_ids else ''
    if v.places_other:
        places = (places + ', ' + v.places_other) if places else v.places_other
    return places


def _build_master_row(visit_record, uid):
    v = visit_record
    return [
        uid,
        _get_region_flag(v),
        datetime.now().strftime('%m/%d/%Y %H:%M:%S'),
        v.submitter_email or '',
        str(v.arrival_date) if v.arrival_date else '',
        str(v.departure_date) if v.departure_date else '',
        _get_selection_label(v, 'accommodation_type'),
        v.volunteer_id.name or '',
        v.reference_of or '',
        v.main_guest_name or '',
        _get_selection_label(v, 'gender'),
        v.designation_company or '',
        _get_selection_label(v, 'company_sector'),
        v.phone or '',
        v.email or '',
        _get_selection_label(v, 'guest_region'),
        v.address or '',
        v.poc_name or '',
        v.poc_contact or '',
        _build_places_string(v),
        str(v.accompanying_guest_count or 0),
        v.experience_rating or '',
        v.experience_details or '',
        v.action_required or '',
        v.compliments_offered or '',
        v.other_remarks or '',
    ]


def submit_to_google_sheets(visit_record):
    """
    Submit a guest visit record to the Google Sheets Apps Script web app.
    Synchronous — called within the same transaction.
    Returns (success: bool, error: str or None).
    """
    try:
        webapp_url = visit_record.env['ir.config_parameter'].sudo().get_param(
            'sahyog.google_sheets_webapp_url', ''
        )
        if not webapp_url:
            _logger.warning('Google Sheets webapp URL not configured. Skipping visit %s.', visit_record.id)
            return False, 'Webapp URL not configured'

        # Use stored UID or generate a new one
        uid = visit_record.google_sheet_uid or _generate_uid()

        master_row = _build_master_row(visit_record, uid)
        payload = {'masterRow': master_row}

        response = requests.post(
            webapp_url,
            json=payload,
            timeout=30,
            headers={'Content-Type': 'application/json'},
            allow_redirects=True,
        )

        # Google Apps Script redirects POST to GET — check if we got a valid response
        _logger.info('Google Sheets response status=%s for visit %s', response.status_code, visit_record.id)

        if response.status_code >= 400:
            return False, 'HTTP %s: %s' % (response.status_code, response.text[:200])

        _logger.info('Google Sheets sync succeeded for visit %s (UID: %s)', visit_record.id, uid)
        return True, uid

    except requests.Timeout:
        _logger.warning('Google Sheets sync timed out for visit %s', visit_record.id)
        return False, 'Request timed out'
    except Exception as e:
        _logger.exception('Google Sheets sync failed for visit %s: %s', visit_record.id, e)
        return False, str(e)
