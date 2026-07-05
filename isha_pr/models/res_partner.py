from odoo import api, fields, models

INVOLVEMENT_LEVELS = [
    ('low', 'Low'),
    ('moderate', 'Moderate'),
    ('high', 'High'),
]

PR_GENDERS = [
    ('male', 'Male'),
    ('female', 'Female'),
    ('other', 'Other'),
]

PR_SOURCES = [
    ('event', 'Event'),
    ('referral', 'Referral'),
    ('web', 'Web'),
    ('social', 'Social Media'),
    ('other', 'Other'),
]


class ResPartner(models.Model):
    _inherit = 'res.partner'

    # PR fields live on the SHARED person — the partner is never center-scoped;
    # only the interactions (episodes) are. Guest Care's views never render
    # these, so they stay PR-only in practice.
    is_pr_contact = fields.Boolean('PR Contact', index=True)

    # ── Involvement with the Foundation ──
    pr_involvement = fields.Selection(INVOLVEMENT_LEVELS, string='Involvement Level')
    pr_owner_id = fields.Many2one('res.users', string='Relationship Owner')
    pr_met_sadhguru = fields.Boolean('Met Sadhguru? (SGO Contact)')
    pr_follows_sg = fields.Boolean('Follows SG?')
    pr_source = fields.Selection(PR_SOURCES, string='Source')
    pr_program_ids = fields.Many2many('pr.program', string='Programs')
    pr_campaign_ids = fields.Many2many('pr.campaign', string='Campaigns')

    # ── Contact extras (native email/phone/address/image reused as-is) ──
    pr_alternate_name = fields.Char('Alternate Name')
    pr_secondary_email = fields.Char('Secondary Email')
    pr_secondary_phone = fields.Char('Secondary Phone')
    pr_whatsapp = fields.Char('WhatsApp')
    pr_gender = fields.Selection(PR_GENDERS, string='Gender')
    pr_region_id = fields.Many2one('sahyog.region', string='Region')
    pr_vip = fields.Boolean('VIP')

    # ── Related people & points of contact (hybrid: link OR free-text note) ──
    pr_related_partner_ids = fields.Many2many(
        'res.partner', 'pr_partner_related_rel', 'partner_id', 'related_id',
        string='Related Contacts')
    pr_primary_poc_id = fields.Many2one('res.partner', string='Primary POC')
    pr_secondary_poc_id = fields.Many2one('res.partner', string='Secondary POC')
    pr_poc_notes = fields.Text('POC Notes')  # for "just a name" POCs

    # ── Images: portrait = native image_1920; extras = typed gallery ──
    pr_image_ids = fields.One2many('pr.contact.image', 'partner_id',
                                   string='Images / Documents')

    # ── Interactions ──
    pr_interaction_ids = fields.One2many('pr.interaction', 'partner_id',
                                         string='PR Interactions')
    pr_interaction_count = fields.Integer(compute='_compute_pr_interaction_count')

    @api.depends('pr_interaction_ids')
    def _compute_pr_interaction_count(self):
        # Sudo so reading a partner never fails for a non-PR user (e.g. Guest
        # Care reading a shared guest). Count is a coarse indicator only.
        Interaction = self.env['pr.interaction'].sudo()
        for partner in self:
            partner.pr_interaction_count = Interaction.search_count(
                [('partner_id', '=', partner.id)])
