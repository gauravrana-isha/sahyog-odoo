from odoo import models, fields, api, _


class SadhanaPractice(models.Model):
    _name = 'sahyog.sadhana.practice'
    _description = 'Sadhana Practice'
    _sql_constraints = [('name_unique', 'unique(name)', 'Sadhana practice must be unique.')]

    name = fields.Char(required=True)
