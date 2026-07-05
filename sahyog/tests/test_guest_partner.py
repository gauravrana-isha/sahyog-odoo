"""Guest → shared res.partner linkage + dedup (Phase G)."""

from odoo.tests import tagged

from .common import SahyogTransactionCase


@tagged('post_install', '-at_install')
class TestGuestPartner(SahyogTransactionCase):

    def _visit(self, **kw):
        vals = {'volunteer_id': self.emp_a.id, 'main_guest_name': 'Guest'}
        vals.update(kw)
        return self.env['sahyog.guest.visit'].create(vals)

    def test_visit_gets_a_partner(self):
        visit = self._visit(main_guest_name='Alice', email='alice@example.com')
        self.assertTrue(visit.partner_id)
        self.assertEqual(visit.partner_id.name, 'Alice')
        self.assertEqual(visit.partner_id.email, 'alice@example.com')

    def test_same_email_dedupes_to_one_partner(self):
        v1 = self._visit(main_guest_name='Bob', email='bob@example.com')
        v2 = self._visit(main_guest_name='Bob (2nd visit)', email='BOB@example.com')
        self.assertEqual(v1.partner_id, v2.partner_id)  # case-insensitive email match

    def test_same_phone_dedupes_to_one_partner(self):
        v1 = self._visit(main_guest_name='Carol', phone='+15551234')
        v2 = self._visit(main_guest_name='Carol again', phone='+15551234')
        self.assertEqual(v1.partner_id, v2.partner_id)

    def test_different_contacts_are_distinct_people(self):
        v1 = self._visit(email='x@example.com')
        v2 = self._visit(email='y@example.com')
        self.assertNotEqual(v1.partner_id, v2.partner_id)

    def test_explicit_partner_is_respected(self):
        partner = self.env['res.partner'].create({'name': 'VIP'})
        visit = self._visit(partner_id=partner.id, email='ignored@example.com')
        self.assertEqual(visit.partner_id, partner)
