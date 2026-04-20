from odoo import models, fields, api, _


class VolunteerType(models.Model):
    _name = 'sahyog.volunteer.type'
    _description = 'Volunteer Type'
    _constraints = [
        models.Constraint(
            'unique(name)',
            'Volunteer type must be unique.',
        ),
    ]

    name = fields.Char(required=True)
