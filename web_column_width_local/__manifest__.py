{
    'name': 'List Column Widths (Local Persistence)',
    'version': '19.0.1.0.0',
    'category': 'Web',
    'summary': 'Remember manually resized list column widths in browser storage',
    'description': """
        When a user drags a list-view column edge, the resulting widths are
        saved to localStorage (keyed per view, like Odoo's optional-columns
        feature) and restored on every visit. Double-click a resize handle
        to forget the saved widths for that view. No server-side storage.
    """,
    'author': 'Isha',
    'license': 'LGPL-3',
    'depends': ['web'],
    'assets': {
        'web.assets_backend': [
            'web_column_width_local/static/src/**/*',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
