"""Authorization regression tests — the security backbone for P1.2/P1.3.

These assert, at the ORM layer (which the SPA API sits on top of), that record
rules + ACLs enforce access WITHOUT the controller's former blanket sudo():

  * an unrelated volunteer cannot read or mutate another's records,
  * a volunteer cannot create records impersonating someone else,
  * region-shared collaboration still works (a region peer sees guest visits),
  * owners can perform every own-record operation the API needs (guarding
    against over-tightened ACLs that would break the app).

Uses `with_user()` so the checks run exactly as the volunteer group would.
"""

from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError
from odoo.tests import tagged

from .common import SahyogTransactionCase


@tagged('post_install', '-at_install')
class TestApiAuthz(SahyogTransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Volunteer C lives in a DIFFERENT region — a true outsider to A.
        cls.region2 = cls.env['sahyog.region'].create(
            {'name': 'Region 2', 'nationality': 'overseas'})
        cls.user_c, cls.emp_c = cls._make_volunteer(
            'sahyog_vol_c', 'Volunteer C', cls.region2)

        today = fields.Date.today()
        cls.a_silence = cls.env['sahyog.silence.period'].create({
            'volunteer_id': cls.emp_a.id,
            'start_date': today,
            'end_date': today + timedelta(days=3),
            'silence_type': 'personal',
        })
        cls.a_break = cls.env['sahyog.break.period'].create({
            'volunteer_id': cls.emp_a.id,
            'break_type': 'personal',
            'start_date': today,
            'end_date': today + timedelta(days=3),
        })
        cls.a_notif = cls.env['sahyog.notification'].create({
            'volunteer_id': cls.emp_a.id,
            'type': 'info', 'title': 'For A', 'message': 'private',
        })
        # Meeting between A and B — C (a different region) is NOT a participant,
        # so C must not see it (meeting visibility is participant-based).
        cls.a_meeting = cls.env['sahyog.meeting'].create({
            'title': 'A meets B', 'volunteer_id': cls.emp_a.id,
            'meeting_with_id': cls.emp_b.id, 'date': today,
            'start_time': '10:00', 'end_time': '11:00',
        })
        cls.a_visit = cls.env['sahyog.guest.visit'].create({
            'volunteer_id': cls.emp_a.id, 'main_guest_name': 'Guest of A',
        })
        cls.a_slot = cls.env['sahyog.unavailability.slot'].create({
            'volunteer_id': cls.emp_a.id, 'date': today,
            'start_time': '10:00', 'end_time': '11:00',
        })

    # ── Outsider cannot READ another volunteer's records ────────────────

    def test_outsider_cannot_read_silence(self):
        self.assertNotIn(
            self.a_silence,
            self.env['sahyog.silence.period'].with_user(self.user_c).search([]),
        )
        with self.assertRaises(AccessError):
            self.a_silence.with_user(self.user_c).read(['silence_type'])

    def test_outsider_cannot_read_break(self):
        with self.assertRaises(AccessError):
            self.a_break.with_user(self.user_c).read(['break_type'])

    def test_outsider_cannot_read_notification(self):
        with self.assertRaises(AccessError):
            self.a_notif.with_user(self.user_c).read(['message'])

    def test_outsider_cannot_read_meeting(self):
        with self.assertRaises(AccessError):
            self.a_meeting.with_user(self.user_c).read(['title'])

    def test_outsider_cannot_read_unavailability(self):
        with self.assertRaises(AccessError):
            self.a_slot.with_user(self.user_c).read(['date'])

    # ── Outsider cannot WRITE / DELETE another volunteer's records ──────

    def test_outsider_cannot_cancel_silence(self):
        with self.assertRaises(AccessError):
            self.a_silence.with_user(self.user_c).write({'status': 'cancelled'})

    def test_outsider_cannot_write_break(self):
        with self.assertRaises(AccessError):
            self.a_break.with_user(self.user_c).write({'status': 'cancelled'})

    def test_outsider_cannot_delete_notification(self):
        with self.assertRaises(AccessError):
            self.a_notif.with_user(self.user_c).unlink()

    def test_outsider_cannot_cancel_meeting(self):
        with self.assertRaises(AccessError):
            self.a_meeting.with_user(self.user_c).write({'status': 'cancelled'})

    # ── Impersonation prevention ────────────────────────────────────────

    def test_cannot_create_silence_for_another_volunteer(self):
        """Record rule re-checks after create — C cannot file A's silence."""
        with self.assertRaises(AccessError):
            self.env['sahyog.silence.period'].with_user(self.user_c).create({
                'volunteer_id': self.emp_a.id,
                'start_date': fields.Date.today(),
                'end_date': fields.Date.today(),
                'silence_type': 'personal',
            })

    # ── Region-shared collaboration still works ─────────────────────────

    def test_region_peer_can_read_guest_visit(self):
        """B shares A's region → sees A's guest visit (intended sharing)."""
        self.assertTrue(self.a_visit.with_user(self.user_b).read(['main_guest_name']))

    def test_outsider_cannot_read_guest_visit(self):
        """C is in another region → cannot see A's guest visit."""
        with self.assertRaises(AccessError):
            self.a_visit.with_user(self.user_c).read(['main_guest_name'])

    # ── Owners can perform every own-record operation the API needs ─────

    def test_owner_can_cancel_own_silence(self):
        self.a_silence.with_user(self.user_a).write({'status': 'cancelled'})
        self.assertEqual(self.a_silence.status, 'cancelled')

    def test_owner_can_write_own_break(self):
        self.a_break.with_user(self.user_a).write({'status': 'cancelled'})
        self.assertEqual(self.a_break.status, 'cancelled')

    def test_owner_can_delete_own_notification(self):
        notif = self.env['sahyog.notification'].create({
            'volunteer_id': self.emp_a.id,
            'type': 'info', 'title': 't', 'message': 'm',
        })
        notif.with_user(self.user_a).unlink()
        self.assertFalse(notif.exists())

    def test_owner_can_delete_own_unavailability(self):
        slot = self.env['sahyog.unavailability.slot'].create({
            'volunteer_id': self.emp_a.id, 'date': fields.Date.today(),
            'start_time': '12:00', 'end_time': '13:00',
        })
        slot.with_user(self.user_a).unlink()
        self.assertFalse(slot.exists())

    def test_volunteer_can_create_own_meeting(self):
        """ACL now grants meeting create; the rule allows a self-authored one."""
        meeting = self.env['sahyog.meeting'].with_user(self.user_b).create({
            'title': 'B meets A', 'volunteer_id': self.emp_b.id,
            'meeting_with_id': self.emp_a.id, 'date': fields.Date.today(),
            'start_time': '14:00', 'end_time': '15:00',
        })
        self.assertTrue(meeting.exists())

    def test_volunteer_can_update_own_profile_fields(self):
        """hr.employee stays read-only for volunteers; the API self-write helper
        escalates. A direct volunteer write must still be denied."""
        with self.assertRaises(AccessError):
            self.emp_a.with_user(self.user_a).write({'work_phone': '123'})
