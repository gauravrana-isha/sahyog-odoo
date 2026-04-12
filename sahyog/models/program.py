from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _


class Program(models.Model):
    _name = 'sahyog.program'
    _description = 'Program'
    _order = 'name'
    _sql_constraints = [('name_unique', 'unique(name)', 'Program name must be unique.')]

    name = fields.Char(required=True)
    description = fields.Text()
    typical_duration_days = fields.Integer()
    gender = fields.Selection([('male', 'Male'), ('female', 'Female')])
    program_type = fields.Selection([
        ('main', 'Main'),
        ('silence', 'Silence'),
        ('other', 'Other'),
    ], required=True, default='main')
    prerequisite_ids = fields.Many2many(
        'sahyog.program', 'sahyog_program_prerequisite_rel',
        'program_id', 'prerequisite_id', string='Prerequisites',
    )

    @api.constrains('prerequisite_ids')
    def _check_no_self_prerequisite(self):
        for rec in self:
            if rec in rec.prerequisite_ids:
                raise ValidationError(_('A program cannot be its own prerequisite.'))
