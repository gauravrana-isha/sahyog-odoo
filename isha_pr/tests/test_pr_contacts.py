"""Full contact field set: create/update, images, programs/campaigns, POC."""

import json

from odoo.tests import tagged

from .common import PRHttpCase

# A valid 1×1 PNG (base64, no data: prefix) for image fields.
PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'


@tagged('post_install', '-at_install')
class TestPRContacts(PRHttpCase):

    def _post(self, path, body, login='pr_four'):
        self.authenticate(login, login)
        r = self.url_open(path, data=json.dumps(body),
                          headers={'Content-Type': 'application/json'})
        self.assertEqual(r.status_code, 200, path)
        return r.json()

    def _detail(self, cid):
        return self.url_open(f'/pr/api/contacts/{cid}').json()['data']

    def test_create_with_full_fields(self):
        res = self._post('/pr/api/contacts/create', {
            'name': 'Ravi', 'email': 'ravi@example.com', 'pr_involvement': 'high',
            'pr_gender': 'male', 'pr_vip': True, 'pr_met_sadhguru': True,
            'function': 'CEO', 'company_name': 'Acme', 'pr_whatsapp': '+91999',
            'pr_secondary_phone': '+91888', 'pr_poc_notes': 'assistant: Sam',
            'program_names': ['Inner Engineering', 'Bhava Spandana'],
            'campaign_names': ['Cauvery Calling'],
        })
        self.assertTrue(res['success'], res.get('error'))
        d = res['data']
        self.assertEqual(d['pr_involvement'], 'high')
        self.assertTrue(d['vip'])
        self.assertTrue(d['met_sadhguru'])
        self.assertEqual(d['function'], 'CEO')
        self.assertEqual(d['secondary_phone'], '+91888')
        self.assertEqual(len(d['programs']), 2)
        self.assertEqual(len(d['campaigns']), 1)
        self.assertEqual(d['poc_notes'], 'assistant: Sam')
        self.assertTrue(self.env['pr.program'].search([('name', '=', 'Inner Engineering')]))

    def test_program_create_on_fly_dedupes(self):
        self._post('/pr/api/contacts/create', {'name': 'A', 'email': 'a@x.com', 'program_names': ['Yoga']})
        self._post('/pr/api/contacts/create', {'name': 'B', 'email': 'b@x.com', 'program_names': ['yoga']})
        self.assertEqual(self.env['pr.program'].search_count([('name', '=ilike', 'yoga')]), 1)

    def test_update_contact_fields(self):
        c = self._post('/pr/api/contacts/create', {'name': 'Meena', 'email': 'm@x.com'})['data']
        res = self._post(f'/pr/api/contacts/{c["id"]}/update',
                        {'pr_involvement': 'moderate', 'city': 'Coimbatore'})
        self.assertEqual(res['data']['pr_involvement'], 'moderate')
        self.assertEqual(res['data']['city'], 'Coimbatore')

    def test_portrait_upload(self):
        c = self._post('/pr/api/contacts/create', {'name': 'Face', 'email': 'face@x.com'})['data']
        self.assertIsNone(c['image_url'])
        self._post(f'/pr/api/contacts/{c["id"]}/update', {'image_1920': PNG_1X1})
        self.assertTrue(self._detail(c['id'])['has_portrait'])

    def test_gallery_add_and_delete(self):
        c = self._post('/pr/api/contacts/create', {'name': 'Card Guy', 'email': 'cg@x.com'})['data']
        add = self._post(f'/pr/api/contacts/{c["id"]}/images',
                        {'image': PNG_1X1, 'kind': 'card_front'})
        self.assertTrue(add['success'], add.get('error'))
        self.assertEqual(self._detail(c['id'])['images'][0]['kind'], 'card_front')
        self._post(f'/pr/api/images/{add["data"]["id"]}/delete', {})
        self.assertEqual(len(self._detail(c['id'])['images']), 0)
