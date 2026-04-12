from odoo import fields, models


class ProgramSchedule(models.Model):
    _name = 'sahyog.program.schedule'
    _description = 'Program Schedule'
    _order = 'start_date desc'

    program_id = fields.Many2one('sahyog.program', required=True, ondelete='cascade')
    start_date = fields.Date(required=True)
    end_date = fields.Date(required=True)
    start_time = fields.Char()
    end_time = fields.Char()
    is_recurring = fields.Boolean(default=False)
    location = fields.Char()
    capacity = fields.Integer()
    fee = fields.Char()
    schedule_status = fields.Selection([
        ('planning', 'Planning'),
        ('upcoming', 'Upcoming'),
        ('completed', 'Completed'),
    ], required=True, default='planning')
    notes = fields.Text()
