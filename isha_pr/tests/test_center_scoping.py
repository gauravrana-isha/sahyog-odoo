"""Center-scoping record rules — including the 4-of-10 subset case."""

from odoo.exceptions import AccessError
from odoo.tests import tagged

from .common import PRTransactionCase


@tagged('post_install', '-at_install')
class TestCenterScoping(PRTransactionCase):

    def _interactions_for(self, user):
        return self.env['pr.interaction'].with_user(user).search([])

    def test_single_center_user_sees_only_that_center(self):
        seen = self._interactions_for(self.user_us)
        self.assertIn(self.int_us, seen)
        self.assertNotIn(self.int_india, seen)

    def test_four_of_ten_sees_exactly_its_subset(self):
        # user_four has centers {1,3,6,9}; US (center 1) is in, India (center 2) is out.
        seen = self._interactions_for(self.user_four)
        self.assertIn(self.int_us, seen)          # center 1 ∈ subset
        self.assertNotIn(self.int_india, seen)    # center 2 ∉ subset

    def test_global_user_sees_all_centers(self):
        seen = self._interactions_for(self.user_global)
        self.assertIn(self.int_us, seen)
        self.assertIn(self.int_india, seen)

    def test_no_centers_sees_nothing(self):
        self.assertFalse(self._interactions_for(self.user_none))

    def test_cannot_read_interaction_outside_your_centers(self):
        with self.assertRaises(AccessError):
            self.int_india.with_user(self.user_us).read(['subject'])

    def test_cannot_log_interaction_in_a_center_you_lack(self):
        with self.assertRaises(AccessError):
            self.env['pr.interaction'].with_user(self.user_us).create({
                'partner_id': self.person.id,
                'center_id': self.india.id,   # user_us has only US
                'subject': 'should fail',
            })

    def test_person_is_global_regardless_of_center(self):
        # The shared person is visible to a user even for centers they can't see.
        name = self.person.with_user(self.user_us).read(['name'])[0]['name']
        self.assertEqual(name, 'Shared Person')
