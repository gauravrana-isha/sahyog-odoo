"""
Silence rules utility module.

Centralises volunteer-type-based silence quotas and provides helpers
for calculating annual silence days and resolving per-volunteer limits.
"""

from datetime import date

# Annual silence quotas keyed by volunteer type name.
# min_days = minimum expected annual silence days (for cadence alerts)
# max_days = maximum annual silence days (for limit warnings); None = unlimited
SILENCE_RULES = {
    'Poornanga': {'min_days': 12, 'max_days': 28},
    'Bramhachari': {'min_days': 28, 'max_days': 42},
    'LTV': {'min_days': 0, 'max_days': None},  # unlimited
}


def get_volunteer_limits(volunteer):
    """Return (min_days, max_days) for a volunteer based on their types.

    When multiple types match, the rule with the highest max_days wins
    (None / unlimited is treated as higher than any finite value).
    If no matching types are found, return (0, None) — unlimited by default.
    """
    best_min = None
    best_max = None
    found = False

    for vtype in volunteer.volunteer_type_ids:
        rule = SILENCE_RULES.get(vtype.name)
        if rule is None:
            continue
        rule_max = rule['max_days']
        if not found or _max_is_higher(rule_max, best_max):
            best_min = rule['min_days']
            best_max = rule_max
        found = True

    if not found:
        return (0, None)

    return (best_min, best_max)


def _max_is_higher(candidate, current):
    """Return True if *candidate* is higher than *current*.

    None means unlimited and is treated as higher than any finite value.
    """
    if candidate is None:
        return True
    if current is None:
        return False
    return candidate > current


def calculate_annual_silence_days(env, volunteer_id, year):
    """Return total silence days for *volunteer_id* in the given calendar *year*.

    Only non-cancelled periods are counted.  Periods that span year
    boundaries are clipped to Jan 1 – Dec 31 of the target year.
    Each period contributes ``(clipped_end - clipped_start).days + 1``.
    """
    NON_CANCELLED = (
        'requested', 'approved', 'on_going',
        'pending_admin', 'pending_volunteer', 'done',
    )

    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    periods = env['sahyog.silence.period'].search([
        ('volunteer_id', '=', volunteer_id),
        ('status', 'in', NON_CANCELLED),
        ('start_date', '<=', year_end),
        ('end_date', '>=', year_start),
    ])

    total = 0
    for period in periods:
        clipped_start = max(period.start_date, year_start)
        clipped_end = min(period.end_date, year_end)
        total += (clipped_end - clipped_start).days + 1

    return total
