# Sahyog — Volunteer Management System

Sahyog is a volunteer management system built as a custom Odoo 19 Community Edition module with a React (Mantine v7) mobile-first SPA for volunteers.

## Architecture

```
sahyog-odoo/
├── sahyog/                    # Custom Odoo module
│   ├── models/                # ORM models (16 models)
│   ├── controllers/           # HTTP controllers (API + SPA)
│   ├── views/                 # Odoo backend XML views
│   ├── data/                  # Seed data, cron, email templates
│   ├── security/              # ACL + record rules
│   ├── static/src/
│   │   ├── dashboard/         # OWL admin dashboard
│   │   ├── gantt/             # OWL Gantt timeline widget
│   │   ├── sidebar_toggle/    # Sidebar collapse toggle
│   │   └── volunteer_app/     # React SPA (Mantine + React Router)
│   └── scripts/               # Migration scripts
├── muk_backend_theme/         # MuK Backend Theme (7 modules)
├── nginx/                     # Nginx config
├── docs/                      # Admin & Volunteer guides
├── docker-compose.yml
├── odoo.conf
└── .github/workflows/         # CI/CD pipeline
```

## Features

### Admin (Odoo Backend)
- Dashboard with 6 summary cards + daily active entries
- Volunteer list with Silence/Break/Programs pill badges
- Approve/reject silence, break, and program requests
- Program & schedule management with prerequisite chains
- Gantt timeline with drag-to-create, filters, tooltips
- Calendar, Kanban, Pivot, Graph views
- CSV import wizard
- Registration link generator
- Collapsible sidebar (MuK theme)

### Volunteer (React SPA)
- Mobile-first 4-tab design: Programs, History, Request, Calendar
- Browse upcoming program schedules with search & enroll
- Request silence/break/program/unavailability with validations
- History with cancel, accept/reject actions
- Team calendar (Gantt) with entry type filter
- Profile with editable fields, multi-select dropdowns, photo upload
- Notification drawer with action links
- Dark mode (follows system preference + manual toggle)

### Backend Logic
- Overlap detection for silence/break periods
- Silence quota limits (Poornanga: 28d, Bramhachari: 42d, LTV: unlimited)
- BFS prerequisite cycle detection
- Daily cron: status transitions, expired auto-cancel, cadence alerts
- Time-window awareness for recurring entries (e.g., 9PM–9AM)
- Meeting conflict detection
- Google OAuth login with role-based redirect

## Tech Stack

| Component | Technology |
|---|---|
| Backend | Odoo 19 (Python 3.12) |
| Database | PostgreSQL 16 |
| Admin UI | Odoo OWL + MuK Backend Theme |
| Volunteer SPA | React 18 + TypeScript + Mantine v7 + Vite |
| Deployment | Docker Compose (Nginx + Odoo + PostgreSQL) |
| CI/CD | GitHub Actions |
| Email | Resend SMTP |
| Auth | Google OAuth + Odoo password |

## Quick Start (Local Development)

```bash
# Clone
git clone https://github.com/gauravrana-isha/sahyog-odoo.git
cd sahyog-odoo

# Create .env from example
cp .env.example .env
# Edit .env with your credentials

# Start services
docker compose up -d

# Initialize database + install module
docker compose run --rm odoo odoo -d sahyog -i sahyog --stop-after-init
docker compose restart odoo

# Install MuK theme
docker compose run --rm odoo odoo -d sahyog -i muk_web_theme --stop-after-init
docker compose restart odoo

# Access
# Admin: http://localhost:8069/web (admin/admin)
# Volunteer SPA: http://localhost:8069/sahyog/app
```

### Build SPA (for development)

```bash
cd sahyog/static/src/volunteer_app
npm install
npm run build    # Production build → static/dist/
```

### Upgrade module after code changes

```bash
docker compose run --rm odoo odoo -d sahyog -u sahyog --stop-after-init
docker compose restart odoo
```

## Data Migration (from Neon PostgreSQL)

```bash
NEON_DATABASE_URL="postgresql://..." \
ODOO_DB=sahyog \
python3 sahyog/scripts/migrate_from_neon.py
```

The script is idempotent — safe to re-run.

## Deployment

### Server
- GCP VM: `sahyog-server` (us-central1-a)
- Domain: `isha.sahyog.online`
- SSL: Let's Encrypt

### CI/CD
Push to `main` triggers automatic deployment:
1. Build SPA in CI
2. SSH to server, pull latest code
3. Copy built SPA dist
4. Upgrade module + restart Odoo

## Documentation

- [Admin Guide](docs/ADMIN_GUIDE.md) — Dashboard, approvals, cron, email, configuration
- [Volunteer Guide](docs/VOLUNTEER_GUIDE.md) — SPA usage, requests, history, calendar, profile

## Models

| Model | Description |
|---|---|
| `hr.employee` (extended) | Volunteer profiles with custom fields |
| `sahyog.silence.period` | Silence periods with overlap detection |
| `sahyog.break.period` | Break periods |
| `sahyog.program` | Programs with prerequisites |
| `sahyog.program.schedule` | Program schedules |
| `sahyog.volunteer.program` | Volunteer-program enrollments |
| `sahyog.meeting` | Meetings with conflict detection |
| `sahyog.notification` | In-app + email notifications |
| `sahyog.calendar.entry` | SQL view (union of all entry types) |
| `sahyog.unavailability.slot` | Single-day unavailability |
| `sahyog.registration.link` | Registration URLs with expiry |
| `sahyog.cron.log` | Cron transition audit log |
| `sahyog.volunteer.type` | Volunteer type master data |
| `sahyog.language` | Language master data |
| `sahyog.region` | Region master data |
| `sahyog.sub.team` | Sub-team master data |

## License

LGPL-3
