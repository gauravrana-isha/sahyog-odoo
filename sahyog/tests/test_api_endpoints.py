"""End-to-end endpoint smoke tests over the shared base controller (P2.1).

Exercises a representative slice of the JSON API through real HTTP so the
base-controller extraction + json_endpoint decorator are covered beyond /me.
"""

import json

from odoo.tests import tagged

from .common import SahyogHttpCase


@tagged('post_install', '-at_install')
class TestApiEndpoints(SahyogHttpCase):

    def _get(self, path):
        resp = self.url_open(path)
        self.assertEqual(resp.status_code, 200, path)
        payload = resp.json()
        self.assertTrue(payload['success'], f'{path}: {payload.get("error")}')
        return payload['data']

    def _post(self, path, body):
        resp = self.url_open(
            path, data=json.dumps(body),
            headers={'Content-Type': 'application/json'},
        )
        self.assertEqual(resp.status_code, 200, path)
        return resp.json()

    def setUp(self):
        super().setUp()
        self.authenticate('sahyog_vol_a', 'sahyog_vol_a')

    def test_dashboard_ok(self):
        data = self._get('/sahyog/api/dashboard')
        self.assertIn('status', data)
        self.assertIn('upcoming_silences', data)

    def test_profile_ok(self):
        data = self._get('/sahyog/api/profile')
        self.assertEqual(data['name'], 'Volunteer A')

    def test_master_data_reads_ok(self):
        # Non-sudo master-data reads must work under the volunteer ACL.
        self.assertIsInstance(self._get('/sahyog/api/regions'), list)
        self.assertIsInstance(self._get('/sahyog/api/languages'), list)
        self.assertIsInstance(self._get('/sahyog/api/centers'), list)

    def test_create_and_cancel_silence_roundtrip(self):
        """A volunteer can create then cancel their own silence — the full
        write path with sudo removed (ACL write grant + record rule)."""
        created = self._post('/sahyog/api/silence/create', {
            'start_date': '2999-01-01', 'end_date': '2999-01-05',
            'silence_type': 'personal', 'notes': 'test',
        })
        self.assertTrue(created['success'], created.get('error'))
        new_id = created['data']['id']

        listing = self._get('/sahyog/api/silence')
        self.assertIn(new_id, [s['id'] for s in listing])

        cancelled = self._post('/sahyog/api/silence/cancel', {'id': new_id})
        self.assertTrue(cancelled['success'], cancelled.get('error'))

    def test_notifications_list_ok(self):
        self.assertIsInstance(self._get('/sahyog/api/notifications'), list)

    def test_guest_visits_domain_controller(self):
        """Covers the split-out guest controller (api_guests.py)."""
        self.assertIsInstance(self._get('/sahyog/api/guest-visits'), list)
        created = self._post('/sahyog/api/guest-visits/create',
                             {'main_guest_name': 'Test Guest'})
        self.assertTrue(created['success'], created.get('error'))
        self.assertEqual(created['data']['main_guest_name'], 'Test Guest')
