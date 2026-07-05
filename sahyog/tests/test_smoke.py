"""Smoke tests — verify the module installs with a coherent security model."""

from odoo.tests import tagged

from .common import SahyogTransactionCase


@tagged('post_install', '-at_install')
class TestSmoke(SahyogTransactionCase):

    def test_security_groups_exist(self):
        self.assertTrue(self.env.ref('sahyog.group_sahyog_volunteer'))
        self.assertTrue(self.env.ref('sahyog.group_sahyog_admin'))

    def test_volunteer_user_linked_to_employee(self):
        self.assertEqual(self.emp_a.user_id, self.user_a)
        self.assertIn(
            self.env.ref('sahyog.group_sahyog_volunteer'),
            self.user_a.group_ids,
        )

    def test_computed_status_defaults_to_available(self):
        self.assertEqual(self.emp_a.computed_status, 'Available')
