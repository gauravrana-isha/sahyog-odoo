"""Shared base for Sahyog JSON API controllers.

Holds the helpers and the `json_endpoint` decorator that every domain
controller reuses, so a new controller is a thin file of routes rather than a
fresh copy of the envelope/serialization boilerplate. See P2.1 in the security
refactor plan.
"""

import functools
import json
import logging

from odoo.http import request
from odoo.exceptions import ValidationError, AccessError

_logger = logging.getLogger(__name__)


def json_endpoint(func):
    """Wrap a controller method with uniform error handling + envelope safety.

    The wrapped method returns either a ready Response (via ``_json_success`` /
    ``_json_error``) or raw data (auto-wrapped in a success envelope). Domain
    errors map to the standard failure envelope with the right HTTP status:
      * ValidationError -> 200 with the message (business rule feedback)
      * AccessError     -> 403 'Access denied'
      * anything else   -> 500 'Internal server error' (logged)
    """
    @functools.wraps(func)
    def wrapper(self, *args, **kwargs):
        try:
            result = func(self, *args, **kwargs)
            # Already a Response (the common case today) — pass through.
            if hasattr(result, 'status_code') or hasattr(result, 'headers'):
                return result
            return self._json_success(result)
        except ValidationError as exc:
            return self._json_error(str(exc))
        except AccessError:
            return self._json_error('Access denied', status=403)
        except Exception:
            _logger.exception('API error in %s', func.__name__)
            return self._json_error('Internal server error', status=500)
    return wrapper


class SahyogControllerBase:
    """Mixin with the request/response helpers shared by all API controllers."""

    # ── Identity ────────────────────────────────────────────────────────

    def _get_volunteer(self):
        """Return the hr.employee linked to the CURRENT user.

        Read as sudo on purpose: the domain pins it to ``user_id = uid`` so it
        can only ever be the caller's OWN record, and hr.employee exposes
        HR-private native fields (birthday, sex) that the volunteer group
        cannot otherwise read. This is legitimate self-access — distinct from
        the cross-record bypass removed elsewhere. All OTHER models are queried
        through the plain ``request.env`` so record rules enforce ownership.
        See SECURITY_REFACTOR.md.
        """
        return request.env['hr.employee'].sudo().search(
            [('user_id', '=', request.env.uid)], limit=1,
        )

    def _self_employee_write(self, volunteer, vals):
        """Write whitelisted fields to the current user's OWN hr.employee.

        hr.employee is intentionally read-only for the volunteer group (an
        ACL decision), so writing one's own profile is a deliberate, narrowly
        scoped superuser escalation — guarded here by an ownership check so it
        can never touch another volunteer's record. See SECURITY_REFACTOR.md.
        """
        if not volunteer or volunteer.user_id.id != request.env.uid:
            raise ValidationError('You can only edit your own profile.')
        volunteer.sudo().write(vals)

    def _check_volunteer_active(self, volunteer):
        """Return a JSON error response if volunteer status is away/left, else None."""
        if volunteer and volunteer.base_status in ('away', 'left'):
            status_label = 'Away' if volunteer.base_status == 'away' else 'Left'
            return self._json_error(
                'Your account is currently marked as %s. Access is restricted.' % status_label,
                status=403,
            )
        return None

    # ── Envelope ────────────────────────────────────────────────────────

    def _json_success(self, data):
        return request.make_json_response({'success': True, 'data': data})

    def _json_error(self, message, status=200):
        return request.make_json_response(
            {'success': False, 'error': message}, status=status,
        )

    # ── Serialization + parsing ─────────────────────────────────────────

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
