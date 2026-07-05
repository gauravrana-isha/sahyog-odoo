# AGENTS.md — sahyog-odoo

Guidance for AI coding agents working in this repository. Read this before making changes.

## What this is

**Sahyog** is a volunteer management system for the ashram Guest Care department, built as a
custom **Odoo 19 Community Edition** module (`sahyog`) plus a **React (Mantine v7) mobile-first
SPA** for volunteers. Admins use the Odoo backend; volunteers use the React SPA served at
`/sahyog/app`.

Odoo 19 targets **Python 3.12**. The database is **PostgreSQL 16**. Everything runs via
Docker Compose (Nginx → Odoo → PostgreSQL).

## Repository layout

```
sahyog-odoo/
├── sahyog/                       # The custom Odoo module (the actual app)
│   ├── __manifest__.py           # Module definition — data files, assets, deps, hooks
│   ├── models/                   # ORM models (~24 .py files, ~2000 LOC)
│   ├── controllers/              # HTTP controllers (api.py is the SPA JSON API, ~1600 LOC)
│   ├── views/                    # Odoo backend XML views (forms, lists, menus, templates)
│   ├── data/                     # Seed data (XML), cron jobs, mail templates, OAuth config
│   ├── security/                 # ir.model.access.csv (ACLs) + sahyog_security.xml (groups/rules)
│   ├── wizard/                   # Transient models (CSV import wizard)
│   ├── utils/                    # Helpers (google_sheets.py)
│   ├── scripts/                  # migrate_from_neon.py (one-off data migration, idempotent)
│   ├── report/                   # Report definitions
│   ├── migrations/               # Odoo version-migration scripts
│   ├── tests/                    # Currently only __init__.py — no Python tests yet
│   └── static/src/
│       ├── dashboard/            # OWL admin dashboard widget
│       ├── gantt/                # OWL Gantt timeline widget
│       ├── sidebar_toggle/       # OWL sidebar collapse toggle
│       ├── schedule_sheet_button/, form_save_button/  # small OWL/SCSS backend tweaks
│       └── volunteer_app/        # React 18 + TypeScript + Vite SPA (the volunteer UI)
├── muk_backend_theme/            # Vendored MuK Backend Theme (7 sub-modules)
├── nginx/                        # Nginx reverse-proxy config
├── docs/                         # ADMIN_GUIDE.md, VOLUNTEER_GUIDE.md
├── docker-compose.yml            # nginx + odoo + db services
├── odoo.conf                     # Odoo server config (addons_path, db connection)
└── .github/workflows/deploy.yml  # CI/CD: build SPA → SSH to GCP → upgrade module → restart
```

## Architecture notes

- **Two UIs, one module.** Admins use Odoo's web backend (XML views + OWL widgets under
  `static/src/{dashboard,gantt,...}`). Volunteers use the React SPA under
  `static/src/volunteer_app`, served by the `SahyogSPA` controller (`controllers/spa.py`).
- **The SPA talks to Odoo over a JSON HTTP API** in `controllers/api.py` — all routes are
  `type='http', auth='user'` under the `/sahyog/api/...` prefix (dashboard, profile, silence,
  breaks, programs, schedules, notifications, unavailability, meetings, guest-visits, calendar,
  master data). Responses use the `{success, data}` / `{success, error}` envelope helpers
  (`_json_success` / `_json_error`). The current user's volunteer is resolved via
  `_get_volunteer()` (searches `hr.employee` by `user_id`).
- **Volunteers are extended `hr.employee` records** — `hr` is a hard dependency; there is no
  separate volunteer model. Custom fields live in `models/hr_employee.py`.
- **`sahyog.calendar.entry` is a SQL view**, not a table — a UNION of silence/break/program/
  unavailability entries. Do not add writable fields to it; change the underlying models.
- **Key business logic** lives in models: overlap detection (time-aware, handles cross-midnight
  windows like 21:00–09:00), silence quotas (`silence_rules.py`), BFS prerequisite cycle
  detection, and a daily cron (`data/cron_data.xml`) that runs status transitions, expiry
  auto-cancel, and cadence alerts. `sahyog.cron.log` audits cron runs.
- **Auth**: Google OAuth (`auth_oauth`) with role-based redirect, plus Odoo password login.
  OAuth config is seeded in `data/oauth_data.xml`; the OAuth flow is in `controllers/oauth.py`.
- **Email** goes through Resend SMTP (configured via env vars in `docker-compose.yml`).

## Working on the code

### Odoo module (Python / XML)

- **After changing Python or XML, upgrade the module** for it to take effect:
  ```bash
  docker compose run --rm odoo odoo -d sahyog -u sahyog --stop-after-init
  docker compose restart odoo
  ```
- **Adding a new model?** You must (1) create `models/<name>.py`, (2) import it in
  `models/__init__.py`, (3) add an access line to `security/ir.model.access.csv`, and
  (4) register any new views/data files in `__manifest__.py`'s `data` list. Missing any of
  these is the usual cause of "model not found" / "access denied" errors.
- **Adding assets** (OWL JS/XML/SCSS for the backend): register them under
  `assets['web.assets_backend']` in `__manifest__.py`.
- **Follow existing Odoo conventions** in neighboring files — model `_name` dotted style
  (`sahyog.silence.period`), field naming, and the helper patterns already in `api.py`
  (`_m2o`, `_m2m`, `_parse_json`, `_check_overlaps`). Match surrounding code.
- **Seed/master data** (regions, centers, volunteer types, languages, programs) is in
  `data/*.xml` with XML IDs — edit those rather than inserting rows manually.

### React SPA (`sahyog/static/src/volunteer_app`)

- Stack: React 18 + TypeScript + **Mantine v7** + React Router v6 + Vite 6. Mobile-first,
  4-tab design. Dark mode follows system preference + manual toggle.
- Commands (run from the `volunteer_app` dir):
  ```bash
  npm install
  npm run dev       # Vite dev server
  npm run build     # tsc + vite build → ../../dist/volunteer_app (this is what Odoo serves)
  npm test          # vitest --run  (src/*.test.ts — e.g. api.test.ts)
  ```
- Vite `base` is `/sahyog/static/dist/volunteer_app/` and output goes to `static/dist/` —
  **the built `dist/` is gitignored** and produced in CI, not committed. When testing SPA
  changes locally, you must `npm run build` and restart Odoo (or serve the built dist).
- SPA API client lives in `src/api.ts`; pages in `src/pages/`, shared UI in `src/components/`.
  Keep API calls going through the `/sahyog/api/...` envelope.

## Build / run / deploy

- **Local dev** (from repo root): `docker compose up -d`, then initialize once:
  ```bash
  docker compose run --rm odoo odoo -d sahyog -i sahyog --stop-after-init
  docker compose run --rm odoo odoo -d sahyog -i muk_web_theme --stop-after-init
  docker compose restart odoo
  ```
  - Admin backend: `http://localhost:8069/web` (admin/admin)
  - Volunteer SPA: `http://localhost:8069/sahyog/app`
- **`.env`** is required (copy from `.env.example`): Postgres creds, Resend SMTP, optional
  Neon URL for migration. `.env` is gitignored — never commit secrets.
- **Deployment is automatic** on push to `main` (`.github/workflows/deploy.yml`): CI builds the
  SPA, SSHes to the GCP VM (`sahyog-server`, domain `isha.sahyog.online`), `git reset --hard
  origin/main`, rsyncs the built SPA dist, upgrades the module, and restarts Odoo. **Pushing to
  `main` ships to production** — be deliberate.

## Testing

- **Python suite** lives in `sahyog/tests/` (`test_smoke`, `test_api_authz`, `test_api_me`,
  `test_api_endpoints`), sharing fixtures from `tests/common.py`. Run it:
  ```bash
  docker compose run --rm odoo odoo -d <db> -u sahyog \
    --test-enable --test-tags=/sahyog --stop-after-init --workers=0 --max-cron-threads=0
  ```
  - ⚠️ **Move `sahyog/static/src/volunteer_app/node_modules` out of the tree first** — Odoo's
    test loader walks the addon and chokes on it (`IsADirectoryError`). It isn't present in
    git/production; it's a local build artifact. Restore it after.
  - `test_api_authz` is the security backbone: it asserts (via `with_user`) that record rules +
    ACLs enforce cross-volunteer isolation *without* the controller relying on `sudo()`. Keep it
    green whenever you touch controllers, ACLs (`ir.model.access.csv`), or rules.
- **SPA suite**: `npm test` (Vitest) from the `volunteer_app` dir.

## Architecture invariants (added by the Phase 0–3 refactor)

- **No `sudo()` bypass in the API.** Controllers query through plain `request.env` so record
  rules enforce ownership. The only allowed escalations are documented in `docs/SECURITY_REFACTOR.md`
  and confined to named spots: self-profile read/write (`_get_volunteer`, `_self_employee_write`),
  the meeting conflict scan (`conflict_env`), and model-layer system side effects (notification
  create / email). Do not reintroduce blanket `sudo()`.
- **Shared controller base.** Request/response helpers live in `controllers/base.py`
  (`SahyogControllerBase` + the `json_endpoint` decorator). New API controllers subclass it; the
  guest-visit domain (`controllers/api_guests.py`) is the reference for splitting `api.py` further.
- **Serialization** belongs on the model (`to_spa_dict()`), not duplicated in the controller.
- **Capability contract is single-source.** `sahyog/api_contract.py` defines capability keys used by
  `/api/me`; `scripts/gen_ts_types.py` generates `volunteer_app/src/generated/capabilities.ts`.
  After editing `api_contract.py`, run the script (and `--check` guards drift).
- **SPA nav/routes are capability-gated** via `/api/me` (`useCapabilities` / `Protected`). This is
  **cosmetic** — the backend always enforces access.
- **SPA assets are content-hashed**; `spa.py` reads the Vite manifest (`.vite/manifest.json`) to
  inject current URLs (collecting CSS transitively across split vendor chunks). Never hard-code
  `assets/index.js`.

## Upgrading Odoo (version-sensitive surfaces)

A major Odoo upgrade breaks APIs yearly. The surfaces most likely to need changes:
- **Controllers** (`controllers/*.py`) — routing, `request` API, `res.users` field renames
  (e.g. `groups_id` → `group_ids` in 19).
- **OWL backend widgets** (`static/src/{dashboard,gantt,...}`) — OWL/asset API churn.
- **Vendored MuK theme** (`muk_backend_theme/`) — must be re-vendored to the matching Odoo version.
- Keep tests green through the upgrade; they catch field/behavior renames early.

## Second app: `isha_pr` (PR contacts & outreach)

The workspace is now **multi-module**. `isha_pr/` is a separate Odoo app + its own
mobile PWA at `/pr/app`, following the same patterns as Sahyog.

- **Shared person.** Guests and PR contacts are the same humans: `res.partner`.
  `sahyog.guest.visit.partner_id` links each visit to a partner (create-or-find,
  deduped by email→phone in `guest_visit.create()`). PR reads a **summary-only**
  guest history off the shared partner — it never sees Guest Care's feedback.
- **Center-scoping.** `pr.interaction` is scoped by `center_id`; a PR user's
  `res.users.pr_center_ids` (any N-of-M subset) drives the record rule
  `[('center_id','in',user.pr_center_ids.ids)]`. `group_isha_pr_global` OR's an
  unrestricted rule for all-center users. **The person (`res.partner`) is never
  center-scoped** — only the interactions are.
- **Reuse.** `isha_pr` depends on `sahyog` and reuses `SahyogControllerBase` +
  `json_endpoint`; `pr_spa.py` mirrors `spa.py`'s Vite-manifest cache-busting.
- **PWA build:** `isha_pr/static/src/pr_app` (`npm run build` → `static/dist/pr_app`,
  gitignored, CI-built). Served by `pr_spa.py` at `/pr/app`, gated to `group_isha_pr`.
- **Tests:** `isha_pr/tests/` — `test_center_scoping` (incl. the 4-of-10 subset)
  and `test_pr_api`. Run with `--test-tags=/isha_pr` (same node_modules caveat).
- Deploy upgrades both: `-u sahyog,isha_pr`.

## Conventions & cautions

- **License is LGPL-3.** Keep new files compatible.
- **Don't edit `muk_backend_theme/`** — it is vendored third-party code (MuK Backend Theme).
- **Don't hand-edit `static/dist/`** — it is generated by `vite build`.
- Prefer editing existing seed XML and models over writing ad-hoc SQL. The `migrate_from_neon.py`
  script is a one-off, idempotent migration tool — not part of normal operation.
- Match the style, comment density, and naming of the file you're editing.
