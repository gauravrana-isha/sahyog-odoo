from odoo import fields, models


class PrContactImage(models.Model):
    _name = 'pr.contact.image'
    _description = 'PR Contact Image / Document'
    _order = 'id'

    partner_id = fields.Many2one('res.partner', string='Contact', required=True,
                                 ondelete='cascade', index=True)
    # Auto-downsized on save so a 4 MB phone photo doesn't bloat the DB.
    image = fields.Image('Image', max_width=1920, max_height=1920, required=True)
    kind = fields.Selection([
        ('card_front', 'Business Card — Front'),
        ('card_back', 'Business Card — Back'),
        ('id', 'ID Document'),
        ('other', 'Other'),
    ], string='Type', default='other', required=True)
    label = fields.Char('Caption')
