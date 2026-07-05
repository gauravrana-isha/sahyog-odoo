# Security refactor — `sudo()` audit & remediation

Context: `controllers/api.py` used `.sudo()` on ~61 call sites, bypassing the
module's *already-correct* record rules and ACLs. This document is the audit
(P1.1) and the plan that P1.2–P1.4 implement.

## Principle

The SPA JSON API must let Odoo's ACLs + record rules enforce access, so the
same groups that drive navigation also gate data. `.sudo()` is reserved for
genuine, narrowly-scoped superuser needs and confined to named helpers.

## Classification of `sudo()` call sites

### Category A — legitimate escalation (keep, via a named helper)

| Site | Why escalation is genuine | Helper |
|---|---|---|
| Profile self-write (`update_profile`, `update_profile_photo`) | `hr.employee` is read-only for volunteers by design; writing your *own* whitelisted fields needs escalation | `_self_employee_write()` — asserts `employee.user_id == uid` first |
| Meeting conflict detection (`create_meeting`) | Reads the *other* participant's silence/break/program/unavailability, which a volunteer cannot normally see | `_sudo()` (read-only, scoped to conflict check) |

### Category B — lazy bypass (remove `sudo()`; rely on ACL + record rule)

All own-record reads, creates, writes, cancels and deletes. Record rules
(`volunteer_id.user_id = user.id`, either-side for meetings, own/region for
guest visits) already scope ownership; they were simply being bypassed.

Removing `sudo()` requires the ACL (first gate) to permit the operation. The
ACLs previously granted volunteers only read+create, so these grants are added
in P1.2:

| Model | ACL change (volunteer group) | Reason |
|---|---|---|
| `sahyog.silence.period` | +write | cancel / accept / reject |
| `sahyog.break.period` | +write | cancel / accept / reject |
| `sahyog.volunteer.program` | +write | cancel / accept / reject |
| `sahyog.notification` | +write, +unlink | mark-read / clear / delete |
| `sahyog.unavailability.slot` | +unlink | delete slot |
| `sahyog.meeting` | +create, +write | create / cancel |
| `sahyog.guest.visit` | +write | update visit |
| `sahyog.calendar.entry` | +read (new ACL) | team calendar (read-only SQL view) |

Record-rule change: `rule_notification_volunteer` gains `perm_unlink=True`
(clear/delete). All other write/unlink perms already existed on the rules.

### Category D — model-layer side effects (sudo INSIDE the model)

Removing the controller's blanket sudo surfaced that some ORM side effects are
genuine *system* actions, not the acting user's: creating a notification **for
another** volunteer, and sending email through `mail.template`. These now run
sudo at the model layer (notification create sites + `_send_email`), so a
volunteer can create a meeting (which notifies the other participant) without
being granted access to other volunteers' notifications or to email templates.
Principle: the user's primary action is rule-enforced; the system's reaction
runs privileged in the model.

### Category C — master data reads (remove `sudo()`; ACL read already granted)

`programs`, `program schedules`, `volunteer types`, `languages`, `regions`,
`centers`, `guest places`, and the annual-silence calculation all read models
the volunteer already has ACL read on. Plain `request.env` suffices.

## Verification

`sahyog/tests/test_api_authz.py` (P1.4) logs in as Volunteer B and asserts B
cannot read or mutate Volunteer A's silence/break/meeting/notification/guest
records via the API, and that B *can* perform every own-record operation
(guarding against over-tightened ACLs). Run:

```bash
docker compose run --rm odoo odoo -d sahyog -u sahyog \
  --test-enable --test-tags=/sahyog --stop-after-init
```
