import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class Notification(models.Model):
    _name = 'sahyog.notification'
    _description = 'Notification'
    _order = 'create_date desc'

    volunteer_id = fields.Many2one('hr.employee', required=True, ondelete='cascade')
    type = fields.Char(required=True)
    title = fields.Char(required=True)
    message = fields.Text(required=True)
    is_read = fields.Boolean(default=False)
    email_sent = fields.Boolean(default=False)

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for rec in records:
            if not rec.email_sent:
                rec._send_email()
        return records

    def action_mark_read(self):
        self.write({'is_read': True})

    def _send_email(self):
        template = self.env.ref('sahyog.mail_template_notification', raise_if_not_found=False)
        if not template:
            _logger.warning('Notification %s: mail template not found', self.id)
            return
        try:
            mail_id = template.send_mail(self.id, force_send=True)
            self.write({'email_sent': True})
            _logger.info('Notification %s: email queued to %s', self.id, self.volunteer_id.work_email)
        except Exception:
            _logger.exception('Notification %s: failed to send email', self.id)
