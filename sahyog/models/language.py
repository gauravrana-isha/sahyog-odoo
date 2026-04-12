from odoo import models, fields, api, _


class Language(models.Model):
    _name = 'sahyog.language'
    _description = 'Language'
    _sql_constraints = [('name_unique', 'unique(name)', 'Language must be unique.')]

    name = fields.Char(required=True)
