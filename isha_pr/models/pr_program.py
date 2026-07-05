from odoo import fields, models


class PrProgram(models.Model):
    _name = 'pr.program'
    _description = 'PR Program'
    _order = 'name'

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)


class PrCampaign(models.Model):
    _name = 'pr.campaign'
    _description = 'PR Campaign'
    _order = 'name'

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
