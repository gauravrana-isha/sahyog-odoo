from odoo import api, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    @api.model_create_multi
    def create(self, vals_list):
        users = super().create(vals_list)
        volunteer_group = self.env.ref('sahyog.group_sahyog_volunteer', raise_if_not_found=False)
        if volunteer_group:
            for user in users:
                if not user.share and volunteer_group not in user.group_ids:
                    user.write({'group_ids': [(4, volunteer_group.id)]})
        return users
