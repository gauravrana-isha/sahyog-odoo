from . import models
from . import controllers
from . import wizard


def _assign_volunteer_group(env):
    """Post-init hook: assign Sahyog Volunteer group to all internal users."""
    volunteer_group = env.ref('sahyog.group_sahyog_volunteer', raise_if_not_found=False)
    if not volunteer_group:
        return
    internal_users = env['res.users'].search([
        ('share', '=', False),
        ('active', '=', True),
    ])
    for user in internal_users:
        if volunteer_group not in user.group_ids:
            user.write({'group_ids': [(4, volunteer_group.id)]})

