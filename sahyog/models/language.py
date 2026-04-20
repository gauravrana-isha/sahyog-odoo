from odoo import models, fields, api, _


class Language(models.Model):
    _name = 'sahyog.language'
    _description = 'Language'
    _constraints = [
        models.Constraint(
            'unique(name)',
            'Language must be unique.',
        ),
    ]

    name = fields.Char(required=True)
