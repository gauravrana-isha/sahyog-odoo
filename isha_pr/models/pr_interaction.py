from odoo import api, fields, models

INTERACTION_TYPES = [
    ('call', 'Call'),
    ('meeting', 'Meeting'),
    ('event', 'Event'),
    ('email', 'Email'),
    ('message', 'Message'),
    ('other', 'Other'),
]


class PrInteraction(models.Model):
    _name = 'pr.interaction'
    _description = 'PR Interaction'
    _order = 'date desc, id desc'

    partner_id = fields.Many2one('res.partner', string='Contact', required=True,
                                 ondelete='cascade', index=True)
    # The center where this interaction happened — the record-rule scoping key.
    center_id = fields.Many2one('sahyog.center', string='Center', required=True, index=True)
    date = fields.Date(default=fields.Date.context_today, required=True)
    interaction_type = fields.Selection(INTERACTION_TYPES, string='Type',
                                        default='meeting', required=True)
    subject = fields.Char()
    notes = fields.Text()
    follow_up_date = fields.Date('Follow-up Date')
    owner_id = fields.Many2one('res.users', string='Logged By',
                               default=lambda self: self.env.uid)

    def to_spa_dict(self):
        """Serialize for the PR PWA."""
        self.ensure_one()
        return {
            'id': self.id,
            'partner_id': ({'id': self.partner_id.id, 'name': self.partner_id.name}
                           if self.partner_id else None),
            'center_id': ({'id': self.center_id.id, 'name': self.center_id.name}
                          if self.center_id else None),
            'date': str(self.date) if self.date else '',
            'interaction_type': self.interaction_type or '',
            'subject': self.subject or '',
            'notes': self.notes or '',
            'follow_up_date': str(self.follow_up_date) if self.follow_up_date else '',
            'owner': self.owner_id.name or '',
        }
