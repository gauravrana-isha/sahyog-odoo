"""Shared fixtures for Sahyog tests.

Provides a base TransactionCase and HttpCase that set up two volunteer
users (each with a linked hr.employee) plus a shared region, so tests can
assert cross-volunteer access boundaries without repeating boilerplate.
"""

from odoo.tests.common import TransactionCase, HttpCase


class SahyogCommon:
    """Fixture helpers shared by the TransactionCase and HttpCase bases."""

    @classmethod
    def _make_volunteer(cls, login, name=None, region=None, admin=False):
        """Create a res.users (in the volunteer or admin group) linked to a
        fresh hr.employee. Returns (user, employee)."""
        group_xmlid = 'sahyog.group_sahyog_admin' if admin else 'sahyog.group_sahyog_volunteer'
        user = cls.env['res.users'].create({
            'name': name or login,
            'login': login,
            'password': login,
            'group_ids': [(4, cls.env.ref(group_xmlid).id)],
        })
        employee = cls.env['hr.employee'].create({
            'name': name or login,
            'user_id': user.id,
            'base_status': 'available',
            'region_id': region.id if region else False,
        })
        return user, employee

    @classmethod
    def _setup_volunteers(cls):
        cls.region = cls.env['sahyog.region'].create(
            {'name': 'Test Region', 'nationality': 'indian'})
        cls.user_a, cls.emp_a = cls._make_volunteer('sahyog_vol_a', 'Volunteer A', cls.region)
        cls.user_b, cls.emp_b = cls._make_volunteer('sahyog_vol_b', 'Volunteer B', cls.region)


class SahyogTransactionCase(SahyogCommon, TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._setup_volunteers()


class SahyogHttpCase(SahyogCommon, HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._setup_volunteers()
