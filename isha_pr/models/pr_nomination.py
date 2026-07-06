import json
import logging
import urllib.request

from odoo import api, fields, models
from odoo.exceptions import UserError

from .tier_criteria import TIER_MEANING, criteria_for

_logger = logging.getLogger(__name__)

# Vertex AI defaults — overridable via ir.config_parameter isha_pr.vertex_*
_VERTEX_DEFAULTS = {'location': 'us-central1', 'model': 'gemini-2.5-flash'}

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
    sources = fields.Text('Sources', help='Human-readable numbered source list')
    source_links = fields.Text('Source Links (JSON)',
                               help='JSON ordered [{"n","title","url"}] for inline [n] citations')
    controversies = fields.Text('Controversies / Risk Flags',
                                help='Scandals, legal issues, polarizing associations surfaced '
                                     'by research — Sadhguru would be publicly linked to this person')
    reputational_risk = fields.Selection(
        [('low', 'Low'), ('medium', 'Medium'), ('high', 'High')],
        string='Reputational Risk', index=True,
        help='Risk to Isha/Sadhguru of publicly engaging this nominee')

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
    research_attempted = fields.Boolean('AI Research Attempted', default=False, copy=False,
                                        help='Set once the auto-research cron has processed this '
                                             'record (success or failure) so it is not retried in a loop')
    research_error = fields.Char('AI Research Error', copy=False)

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

    # ── Nurturing (Step 4/5 — active cultivation toward engagement) ──
    engagement_category = fields.Selection([
        ('program', 'Isha Program'),
        ('save_soil', 'Save Soil'),
        ('sg_event', "Sadhguru's Event"),
        ('pr_amplify', 'PR Amplification (their platform)'),
        ('yogic_city', 'Yogic City (strategic)'),
        ('other', 'Other'),
    ], string='Engagement Category')
    suggested_offering_ids = fields.Many2many('pr.offering', string='Suggested Offerings')
    recommended_event = fields.Char('Recommended Program / Event')
    nurture_group = fields.Boolean('In Nurturing Group?')
    nurture_notes = fields.Text('Nurturing Notes')

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
        self._notify_decision('approved')

    def action_reject(self):
        self._check_approver()
        self.write({'stage': 'rejected', 'approval_status': 'rejected',
                    'approver_id': self.env.uid})
        self._notify_decision('rejected')

    def _notify_decision(self, decision):
        """Tell the nominator's POC the approval decision (if a POC is set
        and they aren't the one who decided)."""
        Notification = self.env['pr.notification']
        for rec in self:
            poc = rec.poc_id
            if poc and poc.id != self.env.uid:
                Notification.notify(
                    poc, f'nomination_{decision}',
                    f'Nomination {decision}',
                    f'{rec.nominee_id.name or "A nominee"} was {decision}.',
                    path=f'/nominations/{rec.id}',
                )

    def action_start_nurturing(self):
        self.write({'stage': 'nurturing'})

    def action_reset_nominated(self):
        self.write({'stage': 'nominated', 'research_attempted': False, 'research_error': False})

    # ── AI auto-research (Nominated → Researched). No button: driven by cron. ──

    def _vertex_cfg(self, key):
        ICP = self.env['ir.config_parameter'].sudo()
        return ICP.get_param('isha_pr.vertex_%s' % key) or _VERTEX_DEFAULTS.get(key)

    def _vertex_token(self):
        """Access token for Vertex. On a GCP VM this uses the instance service
        account via the metadata server (no key). For local/dev, set the system
        parameter isha_pr.vertex_token to a `gcloud auth print-access-token`."""
        tok = self.env['ir.config_parameter'].sudo().get_param('isha_pr.vertex_token')
        if tok:
            return tok
        try:
            req = urllib.request.Request(
                'http://metadata.google.internal/computeMetadata/v1/instance/'
                'service-accounts/default/token', headers={'Metadata-Flavor': 'Google'})
            with urllib.request.urlopen(req, timeout=5) as r:
                return json.load(r)['access_token']
        except Exception as e:  # noqa: BLE001
            raise UserError(
                'No Vertex AI credentials. On the prod GCP VM this uses the instance '
                'service account automatically (grant it roles/aiplatform.user). For '
                'local testing set system parameter isha_pr.vertex_token. (%s)' % e)

    def _has_research_context(self):
        return bool(self.leadership_position or self.organization or self.research_notes)

    def _research_prompt(self):
        c = criteria_for(self.vertical)
        idents = {k: getattr(self, k) for k in (
            'leadership_position', 'organization', 'nominee_city', 'nominee_state',
            'nominee_country', 'instagram', 'linkedin', 'website', 'social_links',
            'social_following') if getattr(self, k)}
        if self.nominee_id.email:
            idents['email'] = self.nominee_id.email
        ctx = ('Context is provided below — still web-search to VERIFY it and to check for '
               'controversy.' if self._has_research_context() else
               'Only the name/basic identifiers are given — web-search to confirm you have the '
               'RIGHT person, not a namesake.')
        return f"""Research this nominee for Isha Outreach and assign an outreach tier (1/2/3)
using the OFFICIAL criteria for their vertical. Be conservative and evidence-based.
USE WEB SEARCH to (a) confirm identity, (b) gauge real influence/reach, and — CRITICALLY —
(c) surface any controversy, scandal, legal issue, extremist tie or reputational risk.
Isha would publicly associate Sadhguru with this person, so known controversies are
decision-critical and must NOT be omitted. {ctx}

NOMINEE: {self.nominee_id.name}
VERTICAL: {c['name']}  (axis: {c['axis']})
IDENTIFIERS: {json.dumps(idents, ensure_ascii=False) or '(only the name)'}
RESEARCH NOTES: {self.research_notes or '(none)'}
NOMINATED BY: {self.nominator_name or '(unknown)'} (a personal/family nominator with no public
profile for the nominee often signals Tier 3)

TIER MEANING: {json.dumps(TIER_MEANING, ensure_ascii=False)}
CRITERIA — Tier 1: {c['t1']}
           Tier 2: {c['t2']}
           Tier 3: {c['t3']}
REVIEWER GUIDANCE: {c['guidance']}

Assess and return:
- identity_confident: are you sure this is the SPECIFIC person, not a namesake?
- tier + tier_confidence per the criteria above
- role, organization, website, linkedin, instagram
- social_following: reach as a short scalar (e.g. "2.79M YouTube", "480K X / Twitter")
- controversies: SPECIFIC scandals / legal issues / polarizing associations, each cited [n];
  write "None found" ONLY if genuine web search surfaces nothing
- reputational_risk: low | medium | high — risk to Isha/Sadhguru of publicly engaging them
- follows_sadhguru
A nominee with strong influence BUT serious unresolved controversy should be Tier 2 at most
and flagged — never a clean Tier 1. Weigh the controversy explicitly in your rationale.

Cite sources inline as [1], [2] … The "sources" array is REQUIRED: every page you cited,
in order, with its real title and URL.

If you CANNOT confidently confirm this specific person's identity, set tier to "" and explain.
Reply ONLY with compact JSON: {{"identity_confident":true/false,"tier":"1|2|3 or empty",
"tier_confidence":0.0,"role":"","organization":"","website":"","linkedin":"","instagram":"",
"social_following":"","controversies":"","reputational_risk":"low|medium|high",
"follows_sadhguru":"yes|no|unknown","rationale":"one paragraph citing the criteria and any risk",
"sources":[{{"title":"","url":"https://..."}}]}}"""

    @staticmethod
    def _first_json(text):
        start = text.find('{')
        if start < 0:
            return None
        depth = 0
        instr = esc = False
        for i in range(start, len(text)):
            ch = text[i]
            if instr:
                esc = (ch == '\\' and not esc)
                if ch == '"' and not esc:
                    instr = False
            elif ch == '"':
                instr = True
            elif ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        return None
        return None

    @staticmethod
    def _build_sources(model_sources, grounding):
        """Ordered, numbered source list for inline [n] citations. The model's own
        list drives the numbering; verified grounding URLs are appended so nothing
        cited is a bare number. Mirrors pr.collab.request._build_sources."""
        links = []
        for i, s in enumerate(model_sources or [], 1):
            if isinstance(s, dict):
                title, url = str(s.get('title') or '').strip(), str(s.get('url') or '').strip()
            else:
                title, url = str(s).strip(), ''
            links.append({'n': i, 'title': title or url or ('Source %d' % i), 'url': url})
        seen = {(l['url'] or l['title']).lower() for l in links}
        for g in (grounding or []):
            key = (g['url'] or g['title']).lower()
            if key in seen:
                continue
            seen.add(key)
            links.append({'n': len(links) + 1, 'title': g['title'], 'url': g['url']})
        if not links:
            return {'sources': False, 'source_links': False}
        return {
            'source_links': json.dumps(links),
            'sources': '; '.join(
                '[%d] %s%s' % (l['n'], l['title'], (' — %s' % l['url']) if l['url'] else '')
                for l in links),
        }

    def _call_vertex(self, token):
        project = self._vertex_cfg('project')
        if not project:
            raise UserError('Set system parameter isha_pr.vertex_project to your GCP project.')
        location, model = self._vertex_cfg('location'), self._vertex_cfg('model')
        endpoint = (f'https://{location}-aiplatform.googleapis.com/v1/projects/{project}'
                    f'/locations/{location}/publishers/google/models/{model}:generateContent')
        # Always web-grounded: identity confirmation AND controversy checks need live search.
        body = {'contents': [{'role': 'user', 'parts': [{'text': self._research_prompt()}]}],
                'tools': [{'googleSearch': {}}],
                'generationConfig': {'temperature': 0.2}}
        req = urllib.request.Request(endpoint, data=json.dumps(body).encode(), method='POST',
                                     headers={'Authorization': 'Bearer %s' % token,
                                              'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.load(resp)
        cand = (data.get('candidates') or [{}])[0]
        parts = ((cand.get('content') or {}).get('parts')) or []
        txt = ''.join(p.get('text', '') for p in parts)
        grounding = []
        gm = cand.get('groundingMetadata') or {}
        for ch in (gm.get('groundingChunks') or []):
            web = ch.get('web') or {}
            uri = web.get('uri')
            if uri:
                grounding.append({'title': (web.get('title') or uri), 'url': uri})
        return self._first_json(txt), grounding

    def _apply_research(self, res, grounding=None):
        """Write AI research back. Unconfirmed identity → flag, no high tier.
        Serious reputational risk → always flagged for a human, never a clean Tier 1."""
        vals = {'research_attempted': True, 'enriched': True, 'research_error': False,
                'research_volunteer': self.research_volunteer or 'AI Research'}
        confident = bool(res.get('identity_confident'))
        tier = res.get('tier') if res.get('tier') in ('1', '2', '3') else ''
        rationale = (res.get('rationale') or '').strip()
        risk = res.get('reputational_risk') if res.get('reputational_risk') in ('low', 'medium', 'high') else ''
        for src, dst in (('role', 'leadership_position'), ('organization', 'organization'),
                         ('website', 'website'), ('linkedin', 'linkedin'),
                         ('instagram', 'instagram'), ('social_following', 'social_following'),
                         ('follows_sadhguru', 'follows_sadhguru')):
            v = str(res.get(src) or '').strip()
            if v and v.lower() not in ('', 'unknown', 'n/a', 'none', '0') and not getattr(self, dst):
                vals[dst] = v
        controversies = str(res.get('controversies') or '').strip()
        if controversies and controversies.lower() not in ('none', 'none found', 'n/a', ''):
            vals['controversies'] = controversies
        if risk:
            vals['reputational_risk'] = risk
        vals.update(self._build_sources(res.get('sources'), grounding))
        if confident and tier:
            vals.update(tier=tier, tier_confidence=float(res.get('tier_confidence') or 0),
                        tier_rationale=rationale, research_status='ok', stage='researched')
            if risk == 'high':
                vals['research_status'] = 'needs_review'  # high risk always gets human eyes
        else:
            # unconfirmed: do not prioritize a guess — deprioritize + flag for a human
            vals.update(tier='3', tier_rationale='[AI could not confirm identity] ' + rationale,
                        research_status='needs_review')
            # stays at 'nominated'; research_attempted stops the retry loop
        self.write(vals)

    def action_run_research(self):
        """Research each record now (used by the cron; also callable manually)."""
        token = self._vertex_token()
        for rec in self:
            try:
                res, grounding = rec._call_vertex(token)
                if not res:
                    raise ValueError('unparseable AI response')
                rec._apply_research(res, grounding)
            except Exception as e:  # noqa: BLE001 — never let one record break the batch
                _logger.warning('AI research failed for nomination %s: %s', rec.id, e)
                rec.write({'research_attempted': True, 'research_status': 'needs_review',
                           'research_error': str(e)[:200]})
            self.env.cr.commit()  # persist per-record so a later failure keeps prior work

    @api.model
    def _cron_auto_research(self, batch=10):
        """Cron: auto-research new nominations (Nominated → Researched).

        No-ops until isha_pr.vertex_project is set, so it's harmless to leave
        enabled before Vertex is configured on the server.
        """
        if not self.env['ir.config_parameter'].sudo().get_param('isha_pr.vertex_project'):
            return
        todo = self.search([('stage', '=', 'nominated'),
                            ('research_attempted', '=', False)], limit=batch)
        if todo:
            _logger.info('Auto-research: processing %d nomination(s)', len(todo))
            todo.action_run_research()

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
            'source_links': self.source_links or '',
            'controversies': self.controversies or '',
            'reputational_risk': self.reputational_risk or '',
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
            'engagement_category': self.engagement_category or '',
            'suggested_offerings': self.suggested_offering_ids.mapped('name'),
            'recommended_event': self.recommended_event or '',
            'nurture_group': self.nurture_group,
            'nurture_notes': self.nurture_notes or '',
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
