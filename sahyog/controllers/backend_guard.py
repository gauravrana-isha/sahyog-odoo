"""Keep SPA-only users out of the raw Odoo backend.

PR and Sahyog volunteers are internal users (needed to authenticate), which by
Odoo default lets them open /web or /odoo and browse every partner, employee,
etc. — bypassing the SPA's per-department filtering. Their whole interface is the
SPA, so we bounce them there whenever they hit a backend entry route.

Only the web-client ENTRY routes are guarded — Home.web_client serves
['/web', '/odoo', '/odoo/<path>', '/scoped_app/<path>']. Sibling routes like
/web/login, /web/image (SPA contact photos), /web/session/* are separate handlers
and stay untouched. Admins (system / sahyog admin / PR admin) keep the backend.
"""
from odoo import http
from odoo.http import request
from odoo.addons.web.controllers.home import Home


class SpaBackendGuard(Home):

    def _spa_home_for(self, user):
        """Where to send a user who hits a backend URL. Returns None only for
        users allowed into /web (admins); everyone else is redirected — SPA users
        to their app, and anyone with NO recognised role to the No Account page
        (default-deny: a role-less internal account never reaches the backend)."""
        def in_group(xmlid):
            group = request.env.ref(xmlid, raise_if_not_found=False)
            return bool(group) and group in user.group_ids

        # Admins (system / Sahyog admin / Vaani-PR admin) keep the backend. A user
        # with BOTH admin roles still lands here and sees the union of their menus.
        if (user.has_group('base.group_system')
                or in_group('sahyog.group_sahyog_admin')
                or in_group('isha_pr.group_isha_pr_admin')):
            return None
        if in_group('sahyog.group_sahyog_volunteer'):
            return '/sahyog/app'
        if in_group('isha_pr.group_isha_pr'):
            return '/pr/app'
        # No role at all → never the raw backend; the role router shows the
        # branded "No Account" page.
        return '/sahyog/redirect'

    @http.route()  # inherit Home.web_client's route definition
    def web_client(self, s_action=None, **kw):
        user = request.env.user
        if user and not user._is_public():
            target = self._spa_home_for(user)
            if target:
                return request.redirect(target)
        return super().web_client(s_action, **kw)
