from odoo import fields, models


class PrOffering(models.Model):
    """An Isha offering / engagement category a nominee can be nurtured toward
    (MoM, Save Soil, IE, PR amplification, Yogic City, WMHD/Earth Day promos…).
    Kept as a small master so the list is editable, not hard-coded.
    """
    _name = 'pr.offering'
    _description = 'Isha Offering / Engagement Category'
    _order = 'sequence, name'

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
