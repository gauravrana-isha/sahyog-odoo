"""
Google Sheets Integration via Apps Script Web App
==================================================

This module submits guest visit data to a Google Apps Script web app endpoint
that appends rows to the Google Form response spreadsheet.

Setup Steps:
1. Create a Google Apps Script project linked to the response spreadsheet.
2. Deploy the script as a web app (Execute as: Me, Access: Anyone).
3. The web app should accept POST requests with JSON body: {"masterRow": [...]}
4. Copy the deployed web app URL.
5. In Odoo, go to Settings → Technical → System Parameters and create:
   - Key: sahyog.google_sheets_webapp_url
   - Value: <your deployed web app URL>
6. The web app will append the masterRow array as a new row in the spreadsheet.

Column order for masterRow (26 columns):
  [0]  UID                      — GUEST-YYYYMMDD-HHMMSSmmm
  [1]  RegionFlag               — SSB / IYC / region name
  [2]  Timestamp                — MM/DD/YYYY HH:MM:SS
  [3]  Email Address            — submitter_email
  [4]  Arrival Date
  [5]  Departure Date
  [6]  Accommodation Type
  [7]  Volunteer Name
  [8]  Reference Of
  [9]  Main Guest Name
  [10] Gender
  [11] Designation and Company
  [12] Company Sector
  [13] Phone
  [14] Email
  [15] Region
  [16] Address
  [17] POC Name
  [18] POC Contact
  [19] Places / Events Attended
  [20] Accompanying Guest Count
  [21] Experience Rating
  [22] Experience Details
  [23] Action Required
  [24] Compliments Offered
  [25] Other Remarks
"""

import logging
import threading
from datetime import datetime

import requests

_logger = logging.getLogger(__name__)


# Center name → region flag mapping
CENTER_FLAG_MAP = {
    'SSB Bangalore': 'SSB',
    'IYC Coimbatore': 'IYC',
}


def _get_region_flag(visit_record):
    """Map the volunteer's center name to SSB/IYC or fall back to region name."""
    center_name = visit_record.center_id.name if visit_record.center_id else ''
    if center_name in CENTER_FLAG_MAP:
        return CENTER_FLAG_MAP[center_name]
    return visit_record.region_id.name if visit_record.region_id else ''


def _get_selection_label(record, field_name):
    """Get the human-readable label for a selection field value."""
    val = record[field_name]
    if not val:
        return ''
    selection = dict(record._fields[field_name].selection)
    return selection.get(val, val)


def _generate_uid():
    """Generate a UID in the format GUEST-YYYYMMDD-HHMMSSmmm."""
    now = datetime.now()
    return 'GUEST-%s-%s' % (
        now.strftime('%Y%m%d'),
        now.strftime('%H%M%S') + '%03d' % (now.microsecond // 1000),
    )


def _build_places_string(v):
    """Combine place_event_ids names with places_other free text."""
    places = ', '.join(v.place_event_ids.mapped('name')) if v.place_event_ids else ''
    if v.places_other:
        places = (places + ', ' + v.places_other) if places else v.places_other
    return places


def _build_master_row(visit_record):
    """Build the master row array matching the Apps Script column order."""
    v = visit_record
    return [
        _generate_uid(),                                                    # UID
        _get_region_flag(v),                                                # RegionFlag
        datetime.now().strftime('%m/%d/%Y %H:%M:%S'),                       # Timestamp
        v.submitter_email or '',                                            # Email Address
        str(v.arrival_date) if v.arrival_date else '',                      # Arrival Date
        str(v.departure_date) if v.departure_date else '',                  # Departure Date
        _get_selection_label(v, 'accommodation_type'),                      # Accommodation Type
        v.volunteer_id.name or '',                                          # Volunteer Name
        v.reference_of or '',                                               # Reference Of
        v.main_guest_name or '',                                            # Main Guest Name
        _get_selection_label(v, 'gender'),                                  # Gender
        v.designation_company or '',                                        # Designation and Company
        _get_selection_label(v, 'company_sector'),                          # Company Sector
        v.phone or '',                                                      # Phone
        v.email or '',                                                      # Email
        _get_selection_label(v, 'guest_region'),                              # Region
        v.address or '',                                                    # Address
        v.poc_name or '',                                                   # POC Name
        v.poc_contact or '',                                                # POC Contact
        _build_places_string(v),                                            # Places/Events
        str(v.accompanying_guest_count or 0),                               # Accompanying Guest Count
        v.experience_rating or '',                                          # Experience Rating
        v.experience_details or '',                                         # Experience Details
        v.action_required or '',                                            # Action Required
        v.compliments_offered or '',                                        # Compliments Offered
        v.other_remarks or '',                                              # Other Remarks
    ]


def submit_to_google_sheets(visit_record):
    """
    Submit a guest visit record to the Google Sheets Apps Script web app.

    Reads the web app URL from ir.config_parameter 'sahyog.google_sheets_webapp_url'.
    POSTs JSON body {"masterRow": [...]} to the web app.

    Returns True on success, False on failure.
    """
    try:
        webapp_url = visit_record.env['ir.config_parameter'].sudo().get_param(
            'sahyog.google_sheets_webapp_url', ''
        )
        if not webapp_url:
            _logger.warning(
                'Google Sheets webapp URL not configured (sahyog.google_sheets_webapp_url). '
                'Skipping sync for visit %s.', visit_record.id
            )
            return False

        master_row = _build_master_row(visit_record)
        payload = {'masterRow': master_row}

        response = requests.post(
            webapp_url,
            json=payload,
            timeout=30,
            headers={'Content-Type': 'application/json'},
        )
        response.raise_for_status()

        _logger.info('Google Sheets sync succeeded for visit %s', visit_record.id)
        return True

    except Exception as e:
        _logger.exception('Google Sheets sync failed for visit %s: %s', visit_record.id, e)
        raise


def _sync_in_thread(db_name, visit_id):
    """
    Run the Google Sheets sync in a background thread with a new cursor.
    Updates google_form_synced and google_form_error on the visit record.
    """
    import odoo
    try:
        registry = odoo.registry(db_name)
        with registry.cursor() as cr:
            env = odoo.api.Environment(cr, odoo.SUPERUSER_ID, {})
            visit = env['sahyog.guest.visit'].browse(visit_id)
            if not visit.exists():
                _logger.warning('Visit %s not found in sync thread', visit_id)
                return

            try:
                submit_to_google_sheets(visit)
                visit.write({
                    'google_form_synced': True,
                    'google_form_error': False,
                })
            except Exception as e:
                visit.write({
                    'google_form_synced': False,
                    'google_form_error': str(e),
                })
    except Exception:
        _logger.exception('Error in Google Sheets sync thread for visit %s', visit_id)


def trigger_async_sync(visit_record):
    """
    Trigger an async Google Sheets sync for the given visit record.
    Spawns a new thread so the main transaction is not blocked.
    """
    db_name = visit_record.env.cr.dbname
    visit_id = visit_record.id
    thread = threading.Thread(
        target=_sync_in_thread,
        args=(db_name, visit_id),
        name='google_sheets_sync_%s' % visit_id,
        daemon=True,
    )
    thread.start()
    _logger.info('Started async Google Sheets sync thread for visit %s', visit_id)
