from odoo import models, fields


class GuestPlace(models.Model):
    _name = 'sahyog.guest.place'
    _description = 'Guest Place / Event'
    _order = 'sort_order, name'

    name = fields.Char(required=True)
    center_id = fields.Many2one('sahyog.center', string='Center',
                                help='If set, only shown for visits at this center. If empty, shown for all centers.')
    sort_order = fields.Integer(default=0)
