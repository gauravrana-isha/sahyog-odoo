from odoo import models, fields, api, _


class SubTeam(models.Model):
    _name = 'sahyog.sub.team'
    _description = 'Sub Team'
    _sql_constraints = [('name_unique', 'unique(name)', 'Sub team name must be unique.')]

    name = fields.Char(required=True)
    description = fields.Text()
    team_lead_id = fields.Many2one('hr.employee', string='Team Lead')
