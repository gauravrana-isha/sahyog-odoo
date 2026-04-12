"""
Pre-migration: remove stale group_sahyog_volunteer → base.group_portal
implication that causes the exclusive-groups conflict in Odoo 19.
Also remove base.group_user → group_sahyog_volunteer implication.
"""
import logging

_logger = logging.getLogger(__name__)


def migrate(cr, version):
    if not version:
        return

    _logger.info("Sahyog pre-migrate: cleaning up stale group implications")

    # Remove group_sahyog_volunteer → base.group_portal implication
    cr.execute("""
        DELETE FROM res_groups_implied_rel
        WHERE gid = (
            SELECT res_id FROM ir_model_data
            WHERE module = 'sahyog' AND name = 'group_sahyog_volunteer'
        )
        AND hid = (
            SELECT res_id FROM ir_model_data
            WHERE module = 'base' AND name = 'group_portal'
        )
    """)
    deleted = cr.rowcount
    if deleted:
        _logger.info("Removed %d stale volunteer→portal implication(s)", deleted)

    # Remove base.group_user → group_sahyog_volunteer implication
    cr.execute("""
        DELETE FROM res_groups_implied_rel
        WHERE gid = (
            SELECT res_id FROM ir_model_data
            WHERE module = 'base' AND name = 'group_user'
        )
        AND hid = (
            SELECT res_id FROM ir_model_data
            WHERE module = 'sahyog' AND name = 'group_sahyog_volunteer'
        )
    """)
    deleted = cr.rowcount
    if deleted:
        _logger.info("Removed %d stale user→volunteer implication(s)", deleted)
