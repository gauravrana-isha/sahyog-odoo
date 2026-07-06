"""Authoritative per-vertical tier criteria (IOT coordinators' doc, 1zzbt…).

Replaces the earlier placeholders. Each entry carries the Tier 1/2/3 definitions,
key indicators, reviewer guidance, and reference examples — fed verbatim to the
tiering AI so tiers reflect the real criteria, not approximations.

Keyed by the canonical vertical code used on pr.nomination.vertical.
"""

# Universal meaning (same across verticals)
TIER_MEANING = {
    '1': 'Priority Lead — clear industry/system/national/international influence.',
    '2': 'Further Review — depends on authority, org size/prominence, whether they '
         'shape the whole org vs. a function, demonstrated impact, strategic relevance.',
    '3': 'Not a Priority Lead — influence primarily local, project-based, or early-stage.',
}

CRITERIA = {
    'business': {
        'name': 'Business & Corporate Leaders',
        'axis': 'the highest level at which they create influence and drive change',
        't1': 'Shapes industries and markets. Founders/Owners/CEOs or C-suite of major orgs '
              'with enterprise-wide or industry-wide strategic influence; visionary '
              'entrepreneurs redefining markets; recognized industry thought leaders.',
        't2': 'Shapes organizations, business units, or major functions through leadership, '
              'innovation, or transformation. Intrapreneurs scaling new ventures; founders/CEOs '
              'of growth-stage companies with traction/funding; VPs, Directors, Heads of '
              'functions; leaders of organizational/digital transformation.',
        't3': 'Influences high-impact decisions or shows disruptive potential but at project/'
              'client/team/early-venture level. Consultants, advisors, specialists; strong ICs; '
              'managers/project leaders; early-stage founders with limited traction.',
        'guidance': 'T1 shapes industries; T2 shapes organizations (whole company or a major '
                    'unit/function); T3 shapes projects or gives strategic support.',
    },
    'medical': {
        'name': 'Healthcare & Medical',
        'axis': 'the highest level at which they influence healthcare practice, education, '
                'research, or systems',
        't1': 'Shapes healthcare systems, clinical practice, medical education, or public health '
              'nationally/internationally. National/intl medical association leaders; CEOs of '
              'major health systems; medical-school deans; directors of recognized research '
              'institutes; researchers influencing practice/policy; global health leaders.',
        't2': 'Shapes healthcare orgs, specialties, departments, or institutions. Hospital '
              'executives; Dept Chairs/Chiefs/Medical Directors; PIs of major/multi-center '
              'studies; Assoc/Full Professors with research+education leadership; founders/CEOs '
              'of health/medtech/biotech with traction.',
        't3': 'Influences patient care, projects, or emerging innovation, locally/project-based. '
              'Practicing physicians without broader leadership; nurses/pharmacists/therapists/'
              'allied health; consultants; early-career physician-scientists; early-stage '
              'health founders without traction.',
        'guidance': 'Evaluate system/national impact over local practice.',
    },
    'asscm': {
        'name': 'Arts, Sports & Cultural (ASSCM)',
        'axis': 'the highest level at which they influence culture, public conversation, '
                'creative industries, or communities',
        't1': 'Shapes culture/public discourse/creative industries nationally or globally. '
              'Internationally recognized athletes; award-winning artists/musicians/filmmakers/'
              'authors/performers; leading journalists/media personalities; digital creators '
              'with sustained large-scale cultural impact; founders of cultural movements.',
        't2': 'Shapes communities, professional fields, or audiences. Established creators with '
              'engaged audiences; pro athletes with regional/national/intl recognition; media '
              'professionals shaping conversations; accomplished artists with recognized bodies '
              'of work; wellness/lifestyle/advocacy creators consistently influencing communities.',
        't3': 'Quality work or creative potential with limited public/industry influence. '
              'Early-stage creators; amateur/semi-pro athletes; independent artists without '
              'significant recognition; local media personalities; growing but local audiences.',
        'guidance': 'Evaluate influence BEFORE audience size. Do NOT rely primarily on follower '
                    'count — weigh engagement, credibility, originality, peer recognition, and '
                    'sustained impact over one-time viral success. Quantify followers/reach/'
                    'engagement for all three tiers where possible.',
    },
    'academia': {
        'name': 'Academic & Research',
        'axis': 'the highest level at which they influence research, education, public policy, '
                'or thought leadership',
        't1': 'Shapes disciplines, public policy, or research agendas nationally/internationally. '
              'Distinguished/chaired professors; university presidents/provosts/deans; directors '
              'of recognized research institutes; national-academy members; researchers '
              'influencing policy/practice/global agendas.',
        't2': 'Shapes universities, institutions, programs, or disciplines. Dept Chairs/School '
              'Directors/Program Directors; Assoc/Full Professors with publication records; PIs '
              'of significant programs; academics translating research into innovation.',
        't3': 'Contributes to research/education/scholarship with recognized expertise but '
              'limited institutional/field influence. Assistant Professors/Lecturers/early-career '
              'faculty; postdocs; developing publication records; recognized teaching excellence.',
        'guidance': 'Evaluate influence BEFORE publication count. Do NOT rely primarily on h-index/'
                    'paper count — consider influence on field, education, policy, industry, society.',
    },
    'ngo_govt': {
        'name': 'Public Service (Government & Civic)',
        'axis': 'the highest level at which they influence public policy, governance, civic '
                'institutions, or societal outcomes',
        't1': 'Shapes public policy/governance/civic systems nationally/internationally. Heads of '
              'state/government; Cabinet Ministers/Secretaries; national legislators with policy '
              'leadership; leaders of major international orgs/agencies; CEOs of nationally/intl '
              'influential nonprofits.',
        't2': 'Shapes agencies, public institutions, nonprofits, or communities. Governors, state '
              'legislators, mayors of major cities, county executives; agency directors; '
              'nonprofit executives/board members; leaders of policy/community-development '
              'initiatives.',
        't3': 'Contributes to public service/civic initiatives locally/project-based. Government '
              'staff/policy professionals; program managers; community organizers/advocates; '
              'local nonprofit leaders; emerging civic leaders.',
        'guidance': 'Do NOT rely on title alone. Weigh scale of the org led, decision-making '
                    'authority, public resources/budgets stewarded, potential societal impact of '
                    'their policy areas, and strategic relevance to Isha (mental health, education, '
                    'youth, leadership, sustainability, agriculture, community wellbeing).',
    },
    'media': {
        'name': 'Media',
        'axis': 'the highest level at which they influence public discourse, journalism, or '
                'public understanding',
        't1': 'Shapes public discourse via nationally/internationally influential platforms with '
              'broad reach and editorial authority. Editors-in-Chief/Editorial Directors of major '
              'outlets; national/intl broadcast anchors; award-winning investigative journalists; '
              'documentary filmmakers with mainstream distribution; media execs setting standards.',
        't2': 'Shapes editorial direction/public conversations/professional audiences via '
              'established orgs. Managing Editors/Executive Producers/Bureau Chiefs; senior '
              'correspondents; podcast hosts on established networks; senior reporters at '
              'recognized regional/national outlets.',
        't3': 'Quality journalism with local/niche/emerging influence. Local journalists; '
              'producers/contributors; independent journalists with developing audiences; '
              'emerging filmmakers/podcasters; niche publications.',
        'guidance': 'Do NOT rely solely on title or audience size. Weigh editorial authority, '
                    'scale/prominence of the platform, network/syndication effect, mainstream '
                    'reach, geographic diversity (esp. beyond India), and journalistic impact. '
                    'HIGHER priority: Reuters/AP/BBC/CNN/ABC/NBC/CBS/NPR/Bloomberg/FT/Economist/'
                    'NYT/WaPo/WSJ editors, nationally syndicated producers. LOWER: local reporters, '
                    'small newsletters, niche YouTube/community podcasts.',
    },
    'emerging': {
        'name': 'Emerging & Next-Generation',
        'axis': 'demonstrated leadership potential and trajectory relative to career stage '
                '(evaluate trajectory rather than current status)',
        't1': 'Exceptional leadership potential / achievements far exceeding career stage, with '
              'national/international recognition. Founders under ~35 with traction/funding/rapid '
              'growth; nationally recognized student leaders; Forbes 30 Under 30 / Rhodes / '
              'Schwarzman / national-award recipients; young innovators already influencing their '
              'industry; leaders of nationally recognized youth movements.',
        't2': 'Strong leadership within organizations, universities, startups, or communities. '
              'Student government presidents / major org leaders; early-stage founders with '
              'traction; young professionals leading projects/teams; rising nonprofit/corporate/'
              'healthcare/public-sector leaders; early-career researchers with notable work.',
        't3': 'Emerging leadership via early achievements with limited sustained/broad impact. '
              'Student leaders; early-career professionals; young entrepreneurs starting ventures; '
              'campus org leaders; community volunteers leading local initiatives.',
        'guidance': 'Do NOT rely on age or title. Weigh achievements RELATIVE to career stage, '
                    'rate of achievement, prestige/competitiveness of associated institutions/'
                    'fellowships, scale of leadership already shown, and trajectory toward future '
                    'influence aligned with Isha. We evaluate trajectory, not current status.',
    },
    'environment': {
        'name': 'Environmental & Sustainability',
        'axis': 'the highest level at which they influence environmental/agricultural/food-system '
                'policy, regenerative farming, conservation, sustainability, or science',
        't1': 'Shapes environmental/agri/food policy, practice, science, or conservation '
              'nationally/internationally. National/intl policymakers over agriculture/food/'
              'environment/climate; leaders over major public agri/environment funding; '
              'internationally recognized climate/soil/agri scientists; IPCC/FAO/CGIAR-level '
              'contributors; CEOs of major environmental/agri orgs; multinational CSOs.',
        't2': 'Shapes organizations, industries, scientific communities, or regions. '
              'Sustainability/ESG executives; leaders advancing regenerative agriculture/soil '
              'health/food systems; founders scaling regen-agri tech; directors of enviro/agri '
              'nonprofits; university researchers leading significant enviro/agri research.',
        't3': 'Contributes via projects/local leadership/emerging innovation. Sustainability '
              'managers/coordinators; enviro/agri consultants; early-career researchers; local '
              'conservation/regen-farming leaders; early-stage enviro/agri founders; educators.',
        'guidance': 'Prioritize ability to influence agriculture, food systems, environmental '
                    'policy, and large-scale ecological outcomes — especially Save Soil & '
                    'regenerative agriculture. For Save Soil the highest-value contacts are often '
                    'NOT activists but: agri/food POLICYMAKERS (change policy/allocate funding); '
                    'leaders controlling major agri/environment BUDGETS; scientists shaping soil '
                    'health/regen-agri EVIDENCE; companies able to COMMERCIALIZE/scale regen '
                    'farming.',
    },
    # Fallbacks for records not yet classified into a real vertical.
    'uncategorized': {
        'name': 'Uncategorized',
        'axis': 'the highest level at which they create influence',
        't1': 'Clear industry/system/national/international influence.',
        't2': 'Shapes an organization or a major function; needs further review.',
        't3': 'Local, project-based, or early-stage influence.',
        'guidance': 'Vertical not yet identified — infer the most fitting vertical from the '
                    'nominee, then apply that vertical\'s logic; flag for human review.',
    },
}
CRITERIA['review'] = CRITERIA['uncategorized']


def criteria_for(vertical_code):
    return CRITERIA.get((vertical_code or '').strip(), CRITERIA['uncategorized'])
