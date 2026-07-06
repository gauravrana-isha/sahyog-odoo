from odoo import fields, models

# Campaigns are ROWS, not columns — a new campaign each cycle adds lines, never
# a schema change. This is the structural fix for "the tracker columns changed
# every year": outreach history grows down, not sideways.
OUTREACH_CAMPAIGNS = [
    ('nov2025', 'Nov 2025 Outreach'),
    ('may2026', 'May 2026 Outreach'),
    ('other', 'Other'),
]


class PrNominationOutreach(models.Model):
    _name = 'pr.nomination.outreach'
    _description = 'Nomination Outreach Touchpoint'
    _order = 'campaign desc, id desc'

    nomination_id = fields.Many2one('pr.nomination', string='Nomination',
                                    required=True, ondelete='cascade', index=True)
    campaign = fields.Selection(OUTREACH_CAMPAIGNS, string='Campaign', required=True)
    status = fields.Char('Outreach Status')
    notes = fields.Text('Notes')
    action_items = fields.Text('Future Action Items')
    recommendation = fields.Char('Recommend for IER 2026')

    def to_spa_dict(self):
        self.ensure_one()
        return {
            'id': self.id,
            'campaign': self.campaign or '',
            'campaign_label': dict(OUTREACH_CAMPAIGNS).get(self.campaign, ''),
            'status': self.status or '',
            'notes': self.notes or '',
            'action_items': self.action_items or '',
            'recommendation': self.recommendation or '',
        }
