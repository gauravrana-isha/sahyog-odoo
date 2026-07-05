from odoo import fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    # The centers a PR user may access. A user with 4 of 10 centers has those 4
    # here; the record rule filters interactions to `center_id in pr_center_ids`.
    # Users in group_isha_pr_global bypass this via an OR'd unrestricted rule.
    pr_center_ids = fields.Many2many(
        'sahyog.center', 'isha_pr_user_center_rel', 'user_id', 'center_id',
        string='PR Centers',
    )
