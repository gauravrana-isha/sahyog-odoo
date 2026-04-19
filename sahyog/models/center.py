from odoo import models, fields


class Center(models.Model):
    _name = 'sahyog.center'
    _description = 'Center'
    _order = 'name'
    _sql_constraints = [('name_unique', 'unique(name)', 'Center name must be unique.')]

    name = fields.Char(required=True)
