from odoo import api, fields, models


class PrNotification(models.Model):
    """In-app notification for PR users (bell in the PR PWA header).

    Mirrors the sahyog.notification architecture, but targets res.users
    (PR users are backend users, not employees) and carries a SPA `path`
    for tap-through navigation instead of inline action tokens.
    """
    _name = 'pr.notification'
    _description = 'PR Notification'
    _order = 'create_date desc'

    user_id = fields.Many2one('res.users', required=True, ondelete='cascade', index=True)
    type = fields.Char(required=True)
    title = fields.Char(required=True)
    message = fields.Text(required=True)
    path = fields.Char(help='SPA route to open when tapped, e.g. /nominations/42')
    is_read = fields.Boolean(default=False)

    def to_spa_dict(self):
        self.ensure_one()
        return {
            'id': self.id,
            'type': self.type or '',
            'title': self.title or '',
            'message': self.message or '',
            'path': self.path or '',
            'is_read': self.is_read,
            'create_date': str(self.create_date) if self.create_date else '',
        }

    @api.model
    def notify(self, users, ntype, title, message, path=''):
        """Create one notification per user (skips duplicates for none)."""
        vals = [{
            'user_id': user.id,
            'type': ntype,
            'title': title,
            'message': message,
            'path': path,
        } for user in users]
        return self.sudo().create(vals) if vals else self.browse()

    @api.model
    def _cron_followup_reminders(self):
        """Daily: remind interaction owners of follow-ups due today."""
        today = fields.Date.context_today(self)
        interactions = self.env['pr.interaction'].sudo().search([
            ('follow_up_date', '=', today),
            ('owner_id', '!=', False),
        ])
        for interaction in interactions:
            partner = interaction.partner_id
            self.notify(
                interaction.owner_id,
                'followup_due',
                'Follow-up due today',
                f'{partner.name or "A contact"} — {interaction.subject or interaction.interaction_type}',
                path=f'/contacts/{partner.id}' if partner else '/follow-ups',
            )
