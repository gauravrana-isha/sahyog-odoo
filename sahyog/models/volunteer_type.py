from odoo import models, fields, api, _


class VolunteerType(models.Model):
    _name = 'sahyog.volunteer.type'
    _description = 'Volunteer Type'
    _sql_constraints = [('name_unique', 'unique(name)', 'Volunteer type must be unique.')]

    name = fields.Char(required=True)
