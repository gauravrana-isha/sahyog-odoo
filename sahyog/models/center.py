from odoo import models, fields


class Center(models.Model):
    _name = 'sahyog.center'
    _description = 'Center'
    _order = 'name'
    _constraints = [
        models.Constraint(
            'unique(name)',
            'Center name must be unique.',
        ),
    ]

    name = fields.Char(required=True)

    # ── Reverse relations for center-specific config ──
    place_ids = fields.One2many('sahyog.guest.place', 'center_id', string='Places / Events')
