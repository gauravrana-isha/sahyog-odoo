from odoo import fields, models


class CronLog(models.Model):
    _name = 'sahyog.cron.log'
    _description = 'Cron Transition Log'
    _order = 'executed_at desc'

    entry_type = fields.Char(required=True)  # 'silence', 'break', 'program'
    entry_id = fields.Integer(required=True)
    volunteer_name = fields.Char(required=True)
    old_status = fields.Char(required=True)
    new_status = fields.Char(required=True)
    executed_at = fields.Datetime(required=True, default=fields.Datetime.now)
