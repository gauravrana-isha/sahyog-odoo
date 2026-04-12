"""
Post-migration: assign Sahyog Volunteer group to all internal users.
"""
import logging

_logger = logging.getLogger(__name__)


def migrate(cr, version):
    if not version:
        return

    _logger.info("Sahyog post-migrate: assigning volunteer group to internal users")

    # Get the volunteer group id
    cr.execute("""
        SELECT res_id FROM ir_model_data
        WHERE module = 'sahyog' AND name = 'group_sahyog_volunteer'
    """)
    row = cr.fetchone()
    if not row:
        _logger.warning("Volunteer group not found, skipping")
        return
    volunteer_gid = row[0]

    # Get all internal (non-share) active users
    cr.execute("""
        SELECT id FROM res_users
        WHERE active = true AND share = false
    """)
    user_ids = [r[0] for r in cr.fetchall()]

    # Add volunteer group to users who don't have it
    added = 0
    for uid in user_ids:
        cr.execute("""
            SELECT 1 FROM res_groups_users_rel
            WHERE gid = %s AND uid = %s
        """, (volunteer_gid, uid))
        if not cr.fetchone():
            cr.execute("""
                INSERT INTO res_groups_users_rel (gid, uid)
                VALUES (%s, %s)
            """, (volunteer_gid, uid))
            added += 1

    _logger.info("Assigned volunteer group to %d users (of %d internal)", added, len(user_ids))
