"""End-to-end test for the /sahyog/api/me capabilities endpoint (P1.5)."""

from odoo.tests import tagged

from .common import SahyogHttpCase


@tagged('post_install', '-at_install')
class TestApiMe(SahyogHttpCase):

    def test_me_returns_volunteer_capabilities(self):
        self.authenticate('sahyog_vol_a', 'sahyog_vol_a')
        resp = self.url_open('/sahyog/api/me')
        self.assertEqual(resp.status_code, 200)
        payload = resp.json()
        self.assertTrue(payload['success'])
        data = payload['data']

        self.assertTrue(data['groups']['volunteer'])
        self.assertFalse(data['groups']['admin'])
        self.assertTrue(data['can']['view_programs'])
        self.assertTrue(data['can']['view_profile'])
        self.assertFalse(data['can']['admin'])
        self.assertEqual(data['volunteer']['name'], 'Volunteer A')

    def test_away_volunteer_loses_feature_access_but_keeps_identity(self):
        self.emp_a.write({'base_status': 'away'})
        self.authenticate('sahyog_vol_a', 'sahyog_vol_a')
        data = self.url_open('/sahyog/api/me').json()['data']
        self.assertFalse(data['can']['view_programs'])
        # Profile stays accessible so the user can see their status.
        self.assertTrue(data['can']['view_profile'])
        self.assertIsNotNone(data['volunteer'])
