from odoo import models, fields, api, _


class Region(models.Model):
    _name = 'sahyog.region'
    _description = 'Region'
    _order = 'sort_order, name'
    _sql_constraints = [('name_unique', 'unique(name)', 'Region name must be unique.')]

    name = fields.Char(required=True)
    nationality = fields.Selection([
        ('indian', 'Indian'),
        ('overseas', 'Overseas'),
    ], required=True)
    sort_order = fields.Integer(default=0)
