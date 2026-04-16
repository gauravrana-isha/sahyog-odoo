# Sahyog Admin Guide

## Overview

Sahyog is a volunteer management system built on Odoo 19. As an admin, you manage volunteers, approve/reject requests, configure programs, and monitor the team through the dashboard.

**Login:** Go to `https://isha.sahyog.online/sahyog/login` → click "Admin login with password" → use your Odoo credentials. Admins are redirected to `/web` (Odoo backend).

---

## Dashboard

The dashboard (`Sahyog → Dashboard`) shows 6 summary cards and today's active entries.

### Summary Cards (clickable)

| Card | What it shows | Clicks to |
|---|---|---|
| **Active** | Volunteers not away/left | Volunteer list (active only) |
| **Guest Care** | Available / Total guest care volunteers | Volunteer list (guest care) |
| **On Silence** | Volunteers with computed status "On Silence" | Silence periods list |
| **On Break** | Volunteers with computed status "On Break" | Breaks list |
| **On Program** | Volunteers with active program enrollments today | Enrollments list |
| **Away** | Volunteers with base_status = away | Volunteer list (away) |

### Today's Active Entries

Three columns showing silence periods, breaks, and program enrollments active today. Click any entry to open its form.

### Quick Links

- **Add Volunteer** → new volunteer form
- **Team Calendar** → Gantt timeline view
- **Manage Programs** → programs list

---

## Volunteer Management

### Volunteer List

`Sahyog → Volunteers`

Columns: Name, Silence (pill badges), Break (pill badges), Programs (pill badges), Status

**Pill badge legend:**
- Grey pill with ✓ = last completed entry
- Blue pill with ● = currently active entry
- Green pill with → = upcoming entry
- `–` = no entries

**Filters:** Type, Status (via expandable filter section)

### Volunteer Form

Tabs: Personal, Volunteer Info, Entries, Emergency

**Key fields:**
- Volunteer Types (multi-select tags: Poornanga, LTV, Bramhachari, etc.)
- Base Status: Available, Break, Away, Left
- Computed Status: auto-calculated from active entries (Silence > Break > Program > base_status)

---

## Approval Flows

### 1. Silence Period Request

**Volunteer requests from SPA:**
1. Volunteer submits silence request → status = `pending_admin`
2. Notification sent to all admins: "Volunteer X has requested a silence period..."
3. Email sent to all admins (via generic notification template)

**Admin actions:**
- Open the silence period form → click **Approve** → status changes to `approved`
- Notification sent to volunteer: "Your silence period has been approved"
- Email sent to volunteer
- Or click **Cancel** → status = `cancelled`, volunteer notified

**Admin creates directly:**
- Admin creates silence period from Odoo backend → status defaults to `approved`
- No approval needed

### 2. Break Period Request

Same flow as silence:
1. Volunteer requests → `pending_admin` → admins notified
2. Admin approves → `approved` → volunteer notified
3. Admin cancels → `cancelled` → volunteer notified

### 3. Program Enrollment Request

1. Volunteer requests enrollment from SPA → `pending_admin` → admins notified
2. Admin approves → `upcoming` → volunteer notified
3. Admin rejects → `dropped` → volunteer notified

**Admin enrolls directly:**
- Admin creates enrollment from backend → status = `upcoming`
- Volunteer receives notification: "You have been enrolled in..."

### 4. Volunteer-Initiated Accept/Reject

When admin creates an entry with status `pending_volunteer`:
1. Volunteer sees it in SPA History with Accept/Reject buttons
2. Volunteer accepts → status changes to `approved` (silence/break) or `upcoming` (program)
3. Volunteer rejects → status changes to `cancelled` (silence/break) or `dropped` (program)

---

## Status Transitions (Cron)

The daily cron job (`Sahyog: Daily Status Transitions`) runs once per day and handles:

### Silence Periods
- `approved` → `on_going` (when today is within date range, non-recurring)
- `on_going` → `done` (when end_date has passed, non-recurring)
- Recurring: `approved` ↔ `on_going` based on time window (e.g., 21:00–09:00)
- Recurring: → `done` when end_date passes

### Break Periods
- `approved` → `on_going` (when today is within date range)
- `on_going` → `done` (when end_date has passed)

### Program Enrollments
- `upcoming` → `done` (when end_date has passed)

### Expired Pending Auto-Cancel
- Silence/Break with `pending_admin` or `pending_volunteer` and `end_date < today` → `cancelled`
- Programs with pending status and `end_date < today` → `dropped`
- Volunteer receives notification about expiration

### Cadence Alerts
- For volunteers with Poornanga (min 12 days/year) or Bramhachari (min 28 days/year) types
- If annual silence days < minimum AND last silence ended 3+ months ago
- Admin notification created: "Volunteer X has only N silence days this year..."

**To run manually:** Settings → Technical → Scheduled Actions → "Sahyog: Daily Status Transitions" → Run Manually

---

## Email Notifications

Every notification created in the system automatically sends an email via the generic notification template.

### When emails are sent:

| Event | Who receives | Email template |
|---|---|---|
| Silence approved | Volunteer | Generic notification |
| Silence cancelled | Volunteer | Generic notification |
| Silence request (from SPA) | All admins | Generic notification |
| Break approved | Volunteer | Generic notification |
| Break cancelled | Volunteer | Generic notification |
| Break request (from SPA) | All admins | Generic notification |
| Program enrollment (by admin) | Volunteer | Generic notification |
| Program request (from SPA) | All admins | Generic notification |
| Meeting scheduled | Both participants | Generic notification |
| Request expired (cron) | Volunteer | Generic notification |
| Cadence alert (cron) | All admins | Generic notification |

### Email Configuration

SMTP is configured via environment variables in `.env`:
- `SMTP_SERVER` = smtp.resend.com
- `SMTP_PORT` = 465
- `SMTP_USER` = resend
- `SMTP_PASSWORD` = (Resend API key)
- `EMAIL_FROM` = noreply@sahyog.online

**To verify:** Settings → Technical → Outgoing Mail Servers → Test Connection

---

## Programs & Schedules

### Programs

`Sahyog → Programs → Programs`

Each program has: name, description, type (main/hatha/silence/other), gender restriction, prerequisites (many2many to other programs), typical duration.

**Prerequisite validation:** BFS cycle detection prevents circular dependencies (A requires B requires A).

### Schedules

`Sahyog → Programs → Schedules`

Each schedule belongs to a program and has: start/end dates, start/end times, is_recurring flag, location, capacity, fee, status (planning/upcoming/completed).

**Upcoming schedules** appear in the volunteer SPA's Programs tab (filtered by type main/hatha, gender, and completed programs).

### Enrollments

`Sahyog → Programs → Enrollments`

Shows all volunteer-program enrollments with status, dates, location.

---

## Leave Management

### Silence Periods

`Sahyog → Leave Management → Silence Periods`

Views: List, Form, Calendar, Kanban, Pivot, Graph

Types: Personal, 9PM-9AM, Program Silence

**Overlap detection:** Cannot create overlapping silence or break periods for the same volunteer (non-cancelled entries only).

**Silence limit warnings:** When a volunteer's annual silence days exceed their type's maximum (Poornanga: 28, Bramhachari: 42, LTV: unlimited), an advisory warning is shown.

### Break Periods

`Sahyog → Leave Management → Breaks`

Types: Personal, Health, Family Emergency

Same overlap detection as silence periods.

### Unavailability

`Sahyog → Leave Management → Unavailability`

Single-day time slots when a volunteer is unavailable. Used for meeting conflict detection.

---

## Team Calendar (Gantt)

`Sahyog → Team Calendar`

Custom OWL Gantt timeline showing all volunteers and their entries (silence, break, program, unavailability) on a timeline.

**Features:**
- Volunteer type multi-select filter
- Entry type multi-select filter
- Drag-to-create, drag-to-move, drag-to-resize
- Tooltip and popover with approve/cancel/open actions
- Away and Left volunteers excluded

---

## Operations

### Meetings

`Sahyog → Operations → Meetings`

Meeting records between two volunteers. Conflict detection warns about overlapping silence/break/program/unavailability.

### Notifications

`Sahyog → Operations → Notifications`

All system notifications. Each notification has: volunteer, type, title, message, is_read, email_sent.

### Registration Links

`Sahyog → Operations → Registration Links`

Generate unique registration URLs for new volunteers. Auto-expire after the set datetime. Copyable URL in form view.

---

## Configuration

### Volunteer Types, Languages, Regions, Sub Teams, Sadhana Practices

`Sahyog → Configuration → [Type]`

Master data lists. Volunteer types are used for silence quota rules (Poornanga, Bramhachari, LTV).

### CSV Import

`Sahyog → Configuration → CSV Import`

Bulk import volunteers from CSV files.

---

## Security

### Groups
- **Sahyog Admin:** Full CRUD on all models
- **Sahyog Volunteer:** Read on most models, create on silence/break/program/unavailability/notification

### Record Rules
- Volunteers can only see/edit their own entries via the SPA API (enforced by `sudo()` + volunteer_id checks in controllers)

---

## Deployment

### CI/CD Pipeline

Push to `main` branch triggers GitHub Actions:
1. Build SPA (`npm ci && npm run build`)
2. SSH to server, `git fetch && reset --hard`
3. Copy built SPA dist
4. `docker compose run --rm odoo odoo -d sahyog -u sahyog --stop-after-init`
5. `docker compose restart odoo`

### Server

- VM: GCP `sahyog-server` in `us-central1-a`
- Domain: `isha.sahyog.online`
- SSL: Let's Encrypt
- Stack: Docker Compose (Nginx + Odoo 19 + PostgreSQL 16)
