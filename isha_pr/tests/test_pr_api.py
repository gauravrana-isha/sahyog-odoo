"""End-to-end PR API tests: capabilities, contacts, interactions, guest summary."""

import json

from odoo.tests import tagged

from .common import PRHttpCase


@tagged('post_install', '-at_install')
class TestPRApi(PRHttpCase):

    def _get(self, path, login='pr_four'):
        self.authenticate(login, login)
        resp = self.url_open(path)
        self.assertEqual(resp.status_code, 200, path)
        payload = resp.json()
        self.assertTrue(payload['success'], f'{path}: {payload.get("error")}')
        return payload['data']

    def _post(self, path, body, login='pr_four'):
        self.authenticate(login, login)
        resp = self.url_open(path, data=json.dumps(body),
                             headers={'Content-Type': 'application/json'})
        self.assertEqual(resp.status_code, 200, path)
        return resp.json()

    def test_me_returns_centers_and_caps(self):
        data = self._get('/pr/api/me', login='pr_four')
        self.assertTrue(data['groups']['pr'])
        self.assertFalse(data['groups']['global'])
        self.assertTrue(data['can']['pr_view_contacts'])
        self.assertEqual(len(data['centers']), 4)  # the 4-of-10 subset

    def test_me_global_user_sees_all_centers(self):
        data = self._get('/pr/api/me', login='pr_global')
        self.assertTrue(data['groups']['global'])
        total = self.env['sahyog.center'].search_count([])
        self.assertEqual(len(data['centers']), total)

    def test_contacts_list_and_search(self):
        listing = self._get('/pr/api/contacts?q=Shared')
        self.assertTrue(any(c['name'] == 'Shared Person' for c in listing))

    def test_contact_detail_includes_guest_summary(self):
        # Link a guest visit to the shared person so summary shows a visit.
        emp = self.env['hr.employee'].create({'name': 'Vol', 'base_status': 'available'})
        self.env['sahyog.guest.visit'].create({
            'volunteer_id': emp.id, 'main_guest_name': 'Shared Person',
            'partner_id': self.person.id, 'arrival_date': '2026-01-01',
        })
        data = self._get(f'/pr/api/contacts/{self.person.id}')
        self.assertEqual(data['guest_summary']['visit_count'], 1)
        self.assertIn('interactions', data)

    def test_log_interaction_in_allowed_center(self):
        res = self._post('/pr/api/interactions/create', {
            'partner_id': self.person.id, 'center_id': self.us.id,
            'interaction_type': 'call', 'subject': 'Follow-up',
        }, login='pr_us')
        self.assertTrue(res['success'], res.get('error'))

    def test_log_interaction_in_forbidden_center_fails(self):
        res = self._post('/pr/api/interactions/create', {
            'partner_id': self.person.id, 'center_id': self.india.id,
            'subject': 'nope',
        }, login='pr_us')
        self.assertFalse(res['success'])  # record rule blocks it
