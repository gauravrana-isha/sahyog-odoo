"""Single source of truth for the SPA API contract (P2.3).

Pure data, no Odoo imports — so it can be consumed both by the Odoo controller
(`/sahyog/api/me`) and by the TS codegen (`scripts/gen_ts_types.py`). Keeping
the capability list here means the backend and the SPA cannot drift.
"""

# Feature capabilities — gated by the volunteer being active (not away/left).
FEATURE_CAPABILITIES = [
    'view_programs',
    'view_history',
    'view_guests',
    'submit_requests',
    'view_calendar',
]

# Capabilities independent of active status.
STATUS_INDEPENDENT_CAPABILITIES = [
    'view_profile',  # always available so an away/left user can see their status
    'admin',
]

ALL_CAPABILITIES = FEATURE_CAPABILITIES + STATUS_INDEPENDENT_CAPABILITIES
