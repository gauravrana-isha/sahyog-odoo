{
    'name': 'Isha PR — Contacts & Outreach',
    'version': '19.0.1.0.0',
    'category': 'Marketing',
    'summary': 'Center-scoped PR contact database and outreach interactions',
    'description': """
        PR relationship management on top of shared res.partner contacts.
        Center-scoped (US / India / …) via record rules, with a mobile PWA
        for field capture. Integrates with Sahyog: a guest a volunteer hosted
        is the same person the PR team engages.
    """,
    'author': 'Isha',
    'license': 'LGPL-3',
    # Depends on sahyog for sahyog.center + guest-visit history + the shared
    # SahyogControllerBase / Vite-manifest asset helper reused by the PWA.
    'depends': ['base', 'mail', 'contacts', 'sahyog'],
    'data': [
        'security/isha_pr_security.xml',
        'security/ir.model.access.csv',
        'data/pr_offering_data.xml',
        'data/config_params.xml',
        'views/pr_interaction_views.xml',
        'views/pr_nomination_views.xml',
        'views/nomination_templates.xml',
        'views/pr_contact_views.xml',
        'views/res_users_views.xml',
        'views/menu_views.xml',
    ],
    'installable': True,
    'application': True,
    'auto_install': False,
}
