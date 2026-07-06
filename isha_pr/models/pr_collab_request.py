import json
import logging
import urllib.request

from odoo import api, fields, models
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)
_VERTEX_DEFAULTS = {'location': 'us-central1', 'model': 'gemini-2.5-flash'}

# A collaboration/opportunity request (podcast, conference, program collab,
# meeting…) flows: Received → Evaluated → Approved → Actioned (+ Declined).
# AI fills the Evaluated stage; every field stays editable by a human.
COLLAB_STAGES = [
    ('received', 'Received'),
    ('evaluated', 'Evaluated'),
    ('approved', 'Approved'),
    ('actioned', 'Actioned'),
    ('declined', 'Declined'),
]

COLLAB_TYPES = [
    ('podcast', 'Podcast'),
    ('conference', 'Conference'),
    ('program', 'Program Collaboration'),
    ('meeting', 'Meeting'),
    ('event', 'Event'),
    ('other', 'Other'),
]

# Who should engage — the routing decision (from "Recommendation by Vinod").
RECOMMENDATION = [
    ('sadhguru', 'Sadhguru-level Engagement'),
    ('global_coordinator', 'Global Coordinator'),
    ('local_teacher', 'Local Teacher'),
    ('decline', 'Decline'),
]

RISK = [('low', 'Low'), ('medium', 'Medium'), ('high', 'High')]


class PrCollabRequest(models.Model):
    _name = 'pr.collab.request'
    _description = 'Collaboration Request'
    _order = 'request_date desc, id desc'

    name = fields.Char('Opportunity', required=True,
                       help='The podcast / event / collaboration, e.g. "PBD Podcast"')
    request_type = fields.Selection(COLLAB_TYPES, string='Type', default='podcast', index=True)
    request_date = fields.Date('Request Date', index=True)

    # ── Intake ──
    host_names = fields.Char('Host / Organizer Names')
    links = fields.Text('Links')
    details = fields.Text('Details / Context',
                          help='The actual ask + any context: what they want (speak, '
                               'podcast, meet), format, dates, who reached out, why now')
    source = fields.Char('Source of Request', help='Email lead / internal research / who raised it')
    requester_name = fields.Char('Requested By')
    requester_email = fields.Char('Requester Email')
    partner_id = fields.Many2one('res.partner', string='Related Contact',
                                 help='The host/organizer as a shared person, if known')

    # ── Qualitative evaluation (AI pre-fills; human editable) ──
    audience_fit = fields.Text('Audience Fit')
    host_credibility = fields.Text('Host Credibility & History')
    brand_alignment = fields.Text('Brand Alignment')
    content_control = fields.Text('Content Control')
    guest_history = fields.Text('Guest History')
    potential_backlash = fields.Text('Potential Backlash')
    opportunity_cost = fields.Text('Opportunity Cost')
    long_term_value = fields.Text('Long-Term Value')

    # ── Quantitative metrics (reach & influence) ──
    audience_size = fields.Char('Audience Size')
    avg_views = fields.Char('Avg Views / Listens')
    engagement_rate = fields.Char('Engagement Rate')
    ratings_score = fields.Char('Ratings Score')
    subscriber_view_ratio = fields.Char('Subscriber–View Ratio')

    # ── Evaluation output ──
    recommendation = fields.Selection(RECOMMENDATION, string='Recommendation', index=True)
    recommendation_notes = fields.Text('Recommendation Notes')
    risk_level = fields.Selection(RISK, string='Backlash Risk')
    eval_summary = fields.Text('Evaluation Summary')
    eval_confidence = fields.Float('AI Confidence')
    sources = fields.Text('Sources', help='Human-readable numbered source list')
    source_links = fields.Text('Source Links (JSON)',
                               help='JSON: ordered [{"n","title","url"}] for inline [n] citations')
    reach_headlines = fields.Text('Reach Headlines (JSON)',
                                  help='JSON {metric_key: short scalar, e.g. "340K members"} '
                                       'for stat-card display; the prose lives on the metric field')

    # ── Workflow ──
    stage = fields.Selection(COLLAB_STAGES, string='Stage', default='received',
                             index=True, group_expand='_expand_stages')
    poc_id = fields.Many2one('res.users', string='Owner')
    decided_by = fields.Many2one('res.users', string='Decided By', readonly=True)
    action_taken = fields.Text('Action Taken')
    notes = fields.Text('Notes')

    # ── AI evaluation bookkeeping ──
    enriched = fields.Boolean('AI Evaluated')
    eval_attempted = fields.Boolean('AI Evaluation Attempted', default=False, copy=False)
    eval_error = fields.Char('AI Evaluation Error', copy=False)
    source_note = fields.Char('Source', help='Provenance, e.g. imported tab')

    @api.model
    def _expand_stages(self, states, domain):
        return [s[0] for s in COLLAB_STAGES]

    def to_spa_light_dict(self):
        self.ensure_one()
        return {
            'id': self.id,
            'name': self.name or '',
            'request_type': self.request_type or '',
            'stage': self.stage or '',
            'recommendation': self.recommendation or '',
            'risk_level': self.risk_level or '',
            'audience_size': self.audience_size or '',
            'request_date': str(self.request_date) if self.request_date else '',
            'poc': self.poc_id.name or '',
        }

    def to_spa_dict(self):
        self.ensure_one()
        fields_list = (
            'name', 'request_type', 'host_names', 'links', 'details', 'source',
            'requester_name', 'requester_email', 'audience_fit', 'host_credibility',
            'brand_alignment', 'content_control', 'guest_history', 'potential_backlash',
            'opportunity_cost', 'long_term_value', 'audience_size', 'avg_views',
            'engagement_rate', 'ratings_score', 'subscriber_view_ratio', 'recommendation',
            'recommendation_notes', 'risk_level', 'eval_summary', 'sources', 'source_links',
            'reach_headlines', 'stage', 'action_taken', 'notes')
        data = {f: (getattr(self, f) or '') for f in fields_list}
        data.update({
            'id': self.id,
            'request_date': str(self.request_date) if self.request_date else '',
            'eval_confidence': self.eval_confidence,
            'enriched': self.enriched,
            'poc': self.poc_id.name or '',
            'decided_by': self.decided_by.name or '',
        })
        return data

    def _check_approver(self):
        if not self.env.user.has_group('isha_pr.group_isha_pr_admin'):
            raise UserError('Only PR Admins can approve or decline collaboration requests.')

    # ── Stage transitions ──
    def action_mark_evaluated(self):
        self.write({'stage': 'evaluated'})

    def action_approve(self):
        self._check_approver()
        self.write({'stage': 'approved', 'decided_by': self.env.uid})

    def action_decline(self):
        self._check_approver()
        self.write({'stage': 'declined', 'recommendation': 'decline',
                    'decided_by': self.env.uid})

    def action_mark_actioned(self):
        self.write({'stage': 'actioned'})

    def action_reset_received(self):
        self.write({'stage': 'received', 'eval_attempted': False, 'eval_error': False})

    # ── AI evaluation (Received → Evaluated). Driven by cron; no button. ──

    def _vertex_cfg(self, key):
        ICP = self.env['ir.config_parameter'].sudo()
        return ICP.get_param('isha_pr.vertex_%s' % key) or _VERTEX_DEFAULTS.get(key)

    def _vertex_token(self):
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
            raise UserError('No Vertex AI credentials (set isha_pr.vertex_token for dev, or '
                            'grant the VM service account roles/aiplatform.user). %s' % e)

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

    def _eval_prompt(self):
        rtype = dict(COLLAB_TYPES).get(self.request_type, self.request_type or 'opportunity')
        return f"""You are advising Isha Foundation on an INBOUND collaboration request.

An external party — "{self.name}" — has REACHED OUT wanting Sadhguru (spiritual leader,
founder of Isha Foundation) to participate ({rtype}). This is THEIR request to collaborate
with Sadhguru; it is NOT Isha reaching out to them.

YOUR JOB: research the REQUESTER and decide whether Isha/Sadhguru should ACCEPT this
opportunity — what Isha/Sadhguru would gain, and what reputational risk it carries.

CRITICAL RULES:
- Every reach / audience / credibility metric MUST describe the REQUESTER
  ("{self.name}" / {self.host_names or 'the host/organizer'}) — NEVER Sadhguru's own
  numbers. Do NOT report Sadhguru's followers, subscribers, or ratings anywhere.
- If a metric does not fit this format (e.g. "avg views" for a live conference), use the
  closest equivalent (attendees, members, circulation) or "N/A" — never pad with our side.
- USE WEB SEARCH and be SPECIFIC, at the depth of a human analyst. Name actual past guests
  by name, give real subscriber / attendee / member counts, describe the real audience
  demographic (age, political or religious leaning, geography), quote real controversies.
  Generic prose ("a large engaged audience") is useless — give names and numbers.
- For EVERY controversy, lawsuit, scandal or dispute you cite, give the CONCRETE specifics:
  the amount ($ figure), the date/year, the parties, and the OUTCOME (jury verdict, settlement,
  resignation, ruling) — e.g. "$11.5M jury verdict, 2023" or "settled for $X in 2021". Never
  write only "there is an ongoing lawsuit" without the figure, date and outcome.
- Cite sources inline as [1], [2] … inside each field, where the number is the position in
  the ordered "sources" array you return. The "sources" array is REQUIRED and must list
  EVERY page you cited, in citation order, each with its real title and URL — never leave
  it empty. Only cite pages you actually used.

REQUEST
  Opportunity   : {self.name}
  Type          : {rtype}
  Host/Organizer: {self.host_names or '(unknown — research who runs it)'}
  Links         : {self.links or '(none)'}
  Context / Ask : {self.details or '(none given — infer the likely ask from the above)'}

RESEARCH & ASSESS (all fields describe the REQUESTER, judged for Isha/Sadhguru):
- audience_size   : the requester's reach — subscribers / followers / members / attendees [n]
- avg_views       : typical views/listens per episode, or event attendance; "N/A" if n/a
- engagement_rate : likes/comments/shares ratio, or audience engagement signal
- ratings_score   : Spotify/Apple/Google rating if a show; else a reputation signal
- subscriber_view_ratio : how much of the audience actually watches (reach quality)
- audience_fit    : WHO listens — demographics, age, political/religious leaning, geography,
                    and how receptive they are to a spiritual figure like Sadhguru [n]
- host_credibility: the host's interviewing style, professionalism, tone, and any past
                    controversy or hostility toward guests [n]
- guest_history   : NAME notable past guests specifically (people, orgs) — this signals the
                    company Sadhguru would be keeping by appearing [n]
- brand_alignment : does the requester's values/positioning fit Isha? political/ideological
                    risk of the association [n]
- content_control : live vs pre-recorded; can topics/edits be reviewed beforehand?
- potential_backlash : SEARCH hard for reputational risk TO Sadhguru/Isha — hostile audience,
                    controversial host, prior guest scandals, likely criticism [n]
- opportunity_cost: is this worth Sadhguru's personal time, or better delegated?
- long_term_value : strategic upside for Isha's mission if accepted

Then decide WHO on the Isha side should engage, and the backlash risk to Isha/Sadhguru:
- recommendation : sadhguru (worth Sadhguru personally) | global_coordinator | local_teacher | decline
- risk_level     : low | medium | high  (reputational risk to Isha/Sadhguru if accepted)

For EACH of the 5 reach metrics, ALSO give a HEADLINE in "headlines": a ≤4-word scalar to
show on a stat card (e.g. "340K members", "26K / event", "4.8★", "3.2% eng.", "N/A"). Keep the
full sentence WITH [n] citations in the metric field; the headline is just the number.

Reply ONLY with compact JSON, keys exactly:
{{"audience_size":"","avg_views":"","engagement_rate":"","ratings_score":"","subscriber_view_ratio":"",
"headlines":{{"audience_size":"","avg_views":"","engagement_rate":"","ratings_score":"","subscriber_view_ratio":""}},
"audience_fit":"","host_credibility":"","guest_history":"","brand_alignment":"","content_control":"",
"potential_backlash":"","opportunity_cost":"","long_term_value":"",
"recommendation":"sadhguru|global_coordinator|local_teacher|decline","risk_level":"low|medium|high",
"confidence":0.0,"summary":"2-3 sentence bottom line for Isha's decision",
"sources":[{{"title":"page title","url":"https://..."}}]}}"""

    def _call_vertex_eval(self, token):
        project = self._vertex_cfg('project')
        if not project:
            raise UserError('Set system parameter isha_pr.vertex_project to your GCP project.')
        loc, model = self._vertex_cfg('location'), self._vertex_cfg('model')
        endpoint = (f'https://{loc}-aiplatform.googleapis.com/v1/projects/{project}'
                    f'/locations/{loc}/publishers/google/models/{model}:generateContent')
        body = {'contents': [{'role': 'user', 'parts': [{'text': self._eval_prompt()}]}],
                'tools': [{'googleSearch': {}}],  # collab eval always web-grounded
                'generationConfig': {'temperature': 0.2}}
        req = urllib.request.Request(endpoint, data=json.dumps(body).encode(), method='POST',
                                     headers={'Authorization': 'Bearer %s' % token,
                                              'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=150) as resp:
            data = json.load(resp)
        cand = (data.get('candidates') or [{}])[0]
        # Grounding-heavy responses occasionally omit content/parts (safety/finish
        # edge cases) — access defensively so it degrades to a clean retry, not a crash.
        parts = ((cand.get('content') or {}).get('parts')) or []
        txt = ''.join(p.get('text', '') for p in parts)
        # Capture the REAL grounding sources (verified URLs Vertex actually retrieved).
        grounding = []
        gm = cand.get('groundingMetadata') or {}
        for ch in (gm.get('groundingChunks') or []):
            web = ch.get('web') or {}
            uri = web.get('uri')
            if uri:
                grounding.append({'title': (web.get('title') or uri), 'url': uri})
        return self._first_json(txt), grounding

    def _apply_eval(self, res, grounding=None):
        vals = {'eval_attempted': True, 'enriched': True, 'eval_error': False, 'stage': 'evaluated'}
        text_fields = ('audience_size', 'avg_views', 'engagement_rate', 'ratings_score',
                       'subscriber_view_ratio', 'audience_fit', 'host_credibility',
                       'guest_history', 'brand_alignment', 'content_control',
                       'potential_backlash', 'opportunity_cost', 'long_term_value')
        # AI (re)fills these; a human edits AFTER, so a fresh eval should overwrite.
        for k in text_fields:
            v = str(res.get(k) or '').strip()
            if v and v.lower() not in ('', 'n/a', 'unknown', 'none'):
                vals[k] = v
        if res.get('recommendation') in ('sadhguru', 'global_coordinator', 'local_teacher', 'decline'):
            vals['recommendation'] = res['recommendation']
        if res.get('risk_level') in ('low', 'medium', 'high'):
            vals['risk_level'] = res['risk_level']
        vals['eval_confidence'] = float(res.get('confidence') or 0)
        vals['eval_summary'] = (res.get('summary') or '').strip() or False
        # Short scalar per metric for stat-card display (prose stays on the field).
        heads = res.get('headlines')
        metric_keys = ('audience_size', 'avg_views', 'engagement_rate',
                       'ratings_score', 'subscriber_view_ratio')
        if isinstance(heads, dict):
            clean = {k: str(heads[k]).strip() for k in metric_keys
                     if str(heads.get(k) or '').strip()}
            vals['reach_headlines'] = json.dumps(clean) if clean else False
        vals.update(self._build_sources(res.get('sources'), grounding))
        self.write(vals)

    @staticmethod
    def _build_sources(model_sources, grounding):
        """Ordered, numbered source list for inline [n] citations. The model's own
        list drives the numbering (its [n] refer to it); verified grounding URLs are
        appended so nothing cited is a dead/bare number."""
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

    def action_run_evaluation(self):
        token = self._vertex_token()
        for rec in self:
            try:
                res, grounding = rec._call_vertex_eval(token)
                if not res:
                    raise ValueError('unparseable AI response')
                rec._apply_eval(res, grounding)
            except Exception as e:  # noqa: BLE001
                _logger.warning('AI eval failed for collab %s: %s', rec.id, e)
                rec.write({'eval_attempted': True, 'eval_error': str(e)[:200]})
            self.env.cr.commit()

    @api.model
    def _cron_auto_evaluate(self, batch=5):
        """Cron: auto-evaluate new collab requests (Received → Evaluated).
        No-ops until isha_pr.vertex_project is set."""
        if not self.env['ir.config_parameter'].sudo().get_param('isha_pr.vertex_project'):
            return
        todo = self.search([('stage', '=', 'received'),
                            ('eval_attempted', '=', False)], limit=batch)
        if todo:
            _logger.info('Auto-eval: processing %d collab request(s)', len(todo))
            todo.action_run_evaluation()
