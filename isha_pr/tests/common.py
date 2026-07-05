"""Shared fixtures for isha_pr tests: centers + PR users with center subsets."""

from odoo.tests.common import TransactionCase, HttpCase


class PRCommon:

    @classmethod
    def _pr_user(cls, login, centers=None, is_global=False):
        groups = ['base.group_user', 'isha_pr.group_isha_pr']
        if is_global:
            groups.append('isha_pr.group_isha_pr_global')
        user = cls.env['res.users'].create({
            'name': login, 'login': login, 'password': login,
            'group_ids': [(4, cls.env.ref(g).id) for g in groups],
        })
        if centers:
            user.pr_center_ids = [(6, 0, [c.id for c in centers])]
        return user

    @classmethod
    def _setup_pr(cls):
        C = cls.env['sahyog.center']
        # Ten centers, so we can exercise "4 of 10".
        cls.centers = C.create([{'name': f'Center {i}'} for i in range(1, 11)])
        cls.us, cls.india = cls.centers[0], cls.centers[1]
        # A person (global) + interactions in different centers.
        cls.person = cls.env['res.partner'].create(
            {'name': 'Shared Person', 'is_pr_contact': True, 'email': 'p@example.com'})
        cls.int_us = cls.env['pr.interaction'].create({
            'partner_id': cls.person.id, 'center_id': cls.us.id, 'subject': 'US meet'})
        cls.int_india = cls.env['pr.interaction'].create({
            'partner_id': cls.person.id, 'center_id': cls.india.id, 'subject': 'India meet'})
        # Users with different center access.
        cls.user_us = cls._pr_user('pr_us', centers=cls.us)
        cls.user_four = cls._pr_user(
            'pr_four', centers=cls.centers[0] | cls.centers[2] | cls.centers[5] | cls.centers[8])
        cls.user_global = cls._pr_user('pr_global', is_global=True)
        cls.user_none = cls._pr_user('pr_none')


class PRTransactionCase(PRCommon, TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._setup_pr()


class PRHttpCase(PRCommon, HttpCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._setup_pr()
