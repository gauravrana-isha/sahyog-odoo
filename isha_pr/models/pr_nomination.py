from odoo import api, fields, models
from odoo.exceptions import UserError

# The nomination lifecycle: a person nominates → a researcher (human OR the AI
# enrichment) fills classification → an APPROVER (human only) approves → the POC
# nurtures. Automation only ever touches the Research step; approval is a hard
# human gate.
STAGES = [
    ('nominated', 'Nominated'),
    ('researched', 'Researched'),
    ('approved', 'Approved'),
    ('nurturing', 'Nurturing'),
    ('rejected', 'Rejected'),
]

RESEARCH_REC = [
    ('recommended', 'Recommended'),
    ('maybe', 'Maybe / Further Review'),
    ('not_recommended', 'Not Recommended'),
]

APPROVAL_STATUS = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
    ('not_applicable', 'Not Applicable'),
]

# Canonical verticals — consolidated from the tracker's 55 raw labels.
VERTICALS = [
    ('business', 'Business & Corporate'),
    ('asscm', 'Arts, Sports & Culture (ASSCM)'),
    ('academia', 'Academia & Education'),
    ('ngo_govt', 'Public Service (Govt & Civic)'),
    ('medical', 'Medical & Healthcare'),
    ('media', 'Media'),
    ('emerging', 'Emerging & Next-Generation'),
    ('environment', 'Environment & Sustainability'),
    ('uncategorized', 'Uncategorized'),
    ('review', 'Uncategorized (needs review)'),
]

TIERS = [
    ('1', 'Tier 1 — Priority Lead'),
    ('2', 'Tier 2 — Further Review'),
    ('3', 'Tier 3 — Not a Priority'),
]

RESEARCH_STATUS = [
    ('ok', 'OK'),
    ('needs_review', 'Needs Review'),
    ('more_info_required', 'More Info Required'),
]

YES_NO_UNKNOWN = [('yes', 'Yes'), ('no', 'No'), ('unknown', 'Unknown')]


class PrNomination(models.Model):
    """A nomination episode for a potential influencer/lead.

    Points at the shared res.partner (the person), mirroring pr.interaction.
    One person may be nominated more than once; each nomination carries its own
    vertical, tier, research and POC lifecycle. The AI enrichment PRE-FILLS
    tier/socials/rationale; every field stays directly editable by a coordinator.
    """
    _name = 'pr.nomination'
    _description = 'Nomination'
    _rec_name = 'nominee_id'
    _order = 'tier, id desc'

    # ── The person (shared, reused) ──
    nominee_id = fields.Many2one('res.partner', string='Nominee', required=True,
                                 ondelete='cascade', index=True)

    # ── Who submitted the nomination ──
    nominator_name = fields.Char('Nominator')
    nominator_email = fields.Char('Nominator Email')
    nominator_phone = fields.Char('Nominator Phone')
    nominator_region = fields.Char('Nominator Region')
    nominator_city = fields.Char('Nominator City')
    nominator_state = fields.Char('Nominator State')
    nominator_country = fields.Char('Nominator Country')
    submission_date = fields.Date('Submitted')

    # ── Web-form declared (public nomination form at /pr/nominate) ──
    is_self_nomination = fields.Boolean('Self-Nomination')
    nominated_for = fields.Char('Nominated For',
                                help='Offering(s) selected on the form, e.g. IER-Special Event 2026')
    proceed_preference = fields.Selection([
        ('self_invite', 'Will invite the nominee directly'),
        ('guidance', 'Wants guidance, will extend the invitation themselves'),
        ('isha_reach_out', 'Prefers Isha to reach out, will facilitate'),
    ], string='Proceed Preference')
    social_links = fields.Text('Website / Social Links',
                               help='Free-text links as entered on the form')
    influence_examples = fields.Text('Sphere of Influence',
                                     help="Examples of the nominee's influence, as shared by the nominator")

    # ── Classification ──
    vertical = fields.Selection(VERTICALS, string='Vertical', index=True)
    tier = fields.Selection(TIERS, string='Tier', index=True)
    tier_confidence = fields.Float('Tier Confidence', help='0–1, from AI enrichment')
    tier_rationale = fields.Text('Tier Rationale')
    sources = fields.Text('Sources', help='Citations backing the research')

    # ── Profile (researched) ──
    leadership_position = fields.Char('Role / Designation')
    organization = fields.Char('Organization')
    website = fields.Char()
    linkedin = fields.Char('LinkedIn')
    instagram = fields.Char('Instagram')
    social_following = fields.Char('Reach / Following')
    nominee_city = fields.Char('City')
    nominee_state = fields.Char('State')
    nominee_country = fields.Char('Country')

    # ── Isha relationship (form-declared / researched; PRS fills the rest later) ──
    is_meditator = fields.Selection(YES_NO_UNKNOWN, string='Meditator?')
    ie_or_shambhavi = fields.Selection(YES_NO_UNKNOWN, string='IE / Shambhavi?')
    follows_sadhguru = fields.Selection(YES_NO_UNKNOWN, string='Follows Sadhguru?')
    previous_engagements = fields.Text('Previous Isha Engagements')

    # ── Pipeline stage (Nominated → Researched → Approved → Nurturing) ──
    stage = fields.Selection(STAGES, string='Stage', default='nominated',
                             index=True, group_expand='_expand_stages')

    # ── Research stage (Research Volunteer OR AI enrichment) ──
    research_volunteer = fields.Char('Research Volunteer')
    research_recommendation = fields.Selection(RESEARCH_REC, string='Research Recommendation')
    high_priority = fields.Boolean('High Priority')
    research_status = fields.Selection(RESEARCH_STATUS, string='Research Flag',
                                       default='needs_review', index=True)
    research_notes = fields.Text('Research / Call Notes')
    enriched = fields.Boolean('AI Enriched', help='Enrichment has pre-filled this record')

    # ── Approval stage (Approver / Rui — human only) ──
    approval_status = fields.Selection(APPROVAL_STATUS, string='Approval Status',
                                       default='pending')
    approval_detail = fields.Char('Approved For', help='e.g. IER-SE, IER + BSP + AEWS')
    response_sent = fields.Boolean('Response Sent?')
    response_sent_note = fields.Char('Response Detail')
    added_to_nominator_group = fields.Boolean('Added to Nominator Group?')
    review_notes_rui = fields.Text('Review Notes (Rui)')
    approver_id = fields.Many2one('res.users', string='Approved By', readonly=True)

    # ── Ownership / follow-up ──
    poc_id = fields.Many2one('res.users', string='Nominator POC')
    next_step = fields.Char('Next Step')

    # ── Outreach campaign history (rows, not columns — see the outreach model) ──
    outreach_ids = fields.One2many('pr.nomination.outreach', 'nomination_id',
                                   string='Outreach Campaigns')

    # ── At-a-glance re-engagement brief (composed from the record) ──
    last_touch = fields.Char('Last Touch', compute='_compute_brief', store=True)
    brief = fields.Text('Re-engagement Brief', compute='_compute_brief', store=True)

    @api.depends('tier', 'vertical', 'high_priority', 'leadership_position',
                 'organization', 'is_meditator', 'next_step', 'research_recommendation',
                 'outreach_ids.status', 'outreach_ids.campaign', 'outreach_ids.recommendation')
    def _compute_brief(self):
        cam_order = {'may2026': 2, 'nov2025': 1, 'other': 0}
        cam_label = dict(self.env['pr.nomination.outreach']._fields['campaign'].selection)
        for r in self:
            # headline: tier · vertical · priority
            tier_lbl = {'1': '🟢 Tier 1 (Priority)', '2': '🟡 Tier 2 (Review)',
                        '3': '⚪ Tier 3'}.get(r.tier, 'Untiered')
            head = f"{tier_lbl} · {dict(VERTICALS).get(r.vertical, '—')}"
            if r.high_priority:
                head += ' · ⚑ High Priority'
            lines = [head]
            role = ' , '.join(x for x in (r.leadership_position, r.organization) if x)
            if role:
                lines.append(role)
            med = {'yes': '🧘 Meditator', 'no': 'Not a meditator'}.get(r.is_meditator)
            if med:
                lines.append(med)
            # most recent outreach
            last = ''
            if r.outreach_ids:
                o = max(r.outreach_ids, key=lambda x: cam_order.get(x.campaign, 0))
                if o.status:
                    last = f"{cam_label.get(o.campaign, '')}: {o.status}"
                    lines.append(f"📞 Last touch — {last}")
                    if o.recommendation:
                        lines.append(f"↳ Recommend IER 2026: {o.recommendation}")
            if r.next_step:
                lines.append(f"➡️ Next: {r.next_step}")
            r.last_touch = last
            r.brief = '\n'.join(lines)

    # ── Provenance ──
    source_tab = fields.Char('Source', help='Which sheet tab this came from')

    @api.model
    def _expand_stages(self, states, domain):
        return [s[0] for s in STAGES]

    def _check_approver(self):
        if not self.env.user.has_group('isha_pr.group_isha_pr_admin'):
            raise UserError('Only PR Admins (approvers) can approve or reject nominations.')

    # ── Stage transitions ──
    def action_mark_researched(self):
        self.write({'stage': 'researched'})

    def action_approve(self):
        self._check_approver()  # human-only gate; AI can never reach this
        self.write({'stage': 'approved', 'approval_status': 'approved',
                    'approver_id': self.env.uid})

    def action_reject(self):
        self._check_approver()
        self.write({'stage': 'rejected', 'approval_status': 'rejected',
                    'approver_id': self.env.uid})

    def action_start_nurturing(self):
        self.write({'stage': 'nurturing'})

    def action_reset_nominated(self):
        self.write({'stage': 'nominated'})

    def to_spa_light_dict(self):
        """Compact serialization for the PWA nominations list."""
        self.ensure_one()
        p = self.nominee_id
        return {
            'id': self.id,
            'nominee': p.name or '',
            'nominee_id': p.id,
            'stage': self.stage or 'nominated',
            'stage_label': dict(STAGES).get(self.stage, ''),
            'tier': self.tier or '',
            'vertical': self.vertical or '',
            'vertical_label': dict(VERTICALS).get(self.vertical, ''),
            'leadership_position': self.leadership_position or '',
            'organization': self.organization or '',
            'high_priority': self.high_priority,
            'is_self_nomination': self.is_self_nomination,
            'submission_date': str(self.submission_date) if self.submission_date else '',
            'image_url': (f'/web/image/res.partner/{p.id}/image_128' if p.image_1920 else None),
        }

    def to_spa_dict(self):
        """Full serialization for the PR PWA nomination detail."""
        self.ensure_one()
        p = self.nominee_id
        data = self.to_spa_light_dict()
        data.update({
            'tier_confidence': self.tier_confidence,
            'tier_rationale': self.tier_rationale or '',
            'sources': self.sources or '',
            'website': self.website or '',
            'linkedin': self.linkedin or '',
            'instagram': self.instagram or '',
            'social_following': self.social_following or '',
            'social_links': self.social_links or '',
            'location': ', '.join(x for x in
                                  (self.nominee_city, self.nominee_state, self.nominee_country) if x),
            'is_meditator': self.is_meditator or '',
            'ie_or_shambhavi': self.ie_or_shambhavi or '',
            'follows_sadhguru': self.follows_sadhguru or '',
            'research_status': self.research_status or '',
            'research_volunteer': self.research_volunteer or '',
            'research_recommendation': self.research_recommendation or '',
            'research_notes': self.research_notes or '',
            'enriched': self.enriched,
            'approval_status': self.approval_status or '',
            'approval_detail': self.approval_detail or '',
            'approver': self.approver_id.name or '',
            'poc': self.poc_id.name or '',
            'next_step': self.next_step or '',
            'brief': self.brief or '',
            'last_touch': self.last_touch or '',
            'email': p.email or '',
            'phone': p.phone or '',
            # Declared on the public form
            'nominated_for': self.nominated_for or '',
            'proceed_preference': self.proceed_preference or '',
            'influence_examples': self.influence_examples or '',
            'nominator_name': self.nominator_name or '',
            'nominator_email': self.nominator_email or '',
            'nominator_phone': self.nominator_phone or '',
            'outreach': [{
                'id': o.id,
                'campaign': o.campaign or '',
                'status': o.status or '',
                'notes': o.notes or '',
            } for o in self.outreach_ids],
        })
        return data
