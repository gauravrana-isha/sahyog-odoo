#!/usr/bin/env python3
"""
One-time migration script: Neon PostgreSQL → Odoo 19 (Sahyog module).

Reads data from the existing Next.js app's Neon PostgreSQL database and creates
corresponding records in Odoo via XML-RPC.

Usage:
    python migrate_from_neon.py [--dry-run]

Environment variables:
    NEON_DATABASE_URL   - PostgreSQL connection string for the source Neon DB
    ODOO_HOST           - Odoo server hostname (default: localhost)
    ODOO_PORT           - Odoo XML-RPC port (default: 8069)
    ODOO_DB             - Odoo database name (default: odoo)
    ODOO_USER           - Odoo admin login (default: admin)
    ODOO_PASSWORD       - Odoo admin password (default: admin)
"""

import argparse
import logging
import os
import sys
import xmlrpc.client
from collections import defaultdict

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("psycopg2 is required. Install with: pip install psycopg2-binary")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("migrate_from_neon")

# ── ID maps: source Neon ID → Odoo ID ──────────────────────────────────
id_map = defaultdict(dict)  # id_map['volunteers'][neon_id] = odoo_employee_id

# ── Stats ───────────────────────────────────────────────────────────────
stats = defaultdict(lambda: {"processed": 0, "succeeded": 0, "failed": 0})


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def odoo_connect():
    """Return (uid, models_proxy) for Odoo XML-RPC."""
    host = os.environ.get("ODOO_HOST", "localhost")
    port = int(os.environ.get("ODOO_PORT", "8069"))
    db = os.environ.get("ODOO_DB", "sahyog")
    user = os.environ.get("ODOO_USER", "admin")
    password = os.environ.get("ODOO_PASSWORD", "admin")

    url = f"http://{host}:{port}"
    common = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/common")
    uid = common.authenticate(db, user, password, {})
    if not uid:
        raise RuntimeError("Odoo authentication failed. Check credentials.")
    models = xmlrpc.client.ServerProxy(f"{url}/xmlrpc/2/object")
    log.info("Connected to Odoo at %s (db=%s, uid=%d)", url, db, uid)
    return uid, models, db, password


def odoo_search(models, db, uid, pw, model, domain):
    """Search Odoo records, return list of IDs."""
    return models.execute_kw(db, uid, pw, model, "search", [domain])


def odoo_create(models, db, uid, pw, model, vals):
    """Create a single Odoo record, return its ID."""
    return models.execute_kw(db, uid, pw, model, "create", [vals])


def odoo_search_read(models, db, uid, pw, model, domain, fields):
    """Search and read Odoo records."""
    return models.execute_kw(
        db, uid, pw, model, "search_read", [domain], {"fields": fields, "limit": 1},
    )


def neon_connect():
    """Return a psycopg2 connection to the source Neon database."""
    dsn = os.environ.get("NEON_DATABASE_URL")
    if not dsn:
        raise RuntimeError("NEON_DATABASE_URL environment variable is required.")
    conn = psycopg2.connect(dsn)
    log.info("Connected to Neon PostgreSQL")
    return conn


def fetch_all(conn, query):
    """Execute query and return all rows as dicts."""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(query)
        return cur.fetchall()


def str_or_false(val):
    """Convert a value to string for Odoo, or False if None/empty."""
    if val is None:
        return False
    s = str(val).strip()
    return s if s else False


def date_or_false(val):
    """Convert a date/datetime to 'YYYY-MM-DD' string or False."""
    if val is None:
        return False
    return str(val)[:10]


def datetime_or_false(val):
    """Convert a datetime to 'YYYY-MM-DD HH:MM:SS' string or False."""
    if val is None:
        return False
    return str(val)[:19]


def bool_val(val):
    """Convert to boolean."""
    return bool(val) if val is not None else False


def int_or_zero(val):
    """Convert to int, default 0."""
    if val is None:
        return 0
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0



# ═══════════════════════════════════════════════════════════════════════
# Field mapping functions (source row dict → Odoo vals dict)
# ═══════════════════════════════════════════════════════════════════════

def map_sub_team(row):
    """Map Neon sub_teams row → sahyog.sub.team vals."""
    return {
        "name": row["name"],
        "description": str_or_false(row.get("description")),
        # team_lead_id is set in a second pass after volunteers are migrated
    }


def map_region(row):
    """Map Neon regions row → sahyog.region vals."""
    nat = str_or_false(row.get("nationality"))
    if nat:
        nat = nat.lower()
    return {
        "name": row["name"],
        "nationality": nat or "indian",
        "sort_order": int_or_zero(row.get("sort_order")),
    }


def map_volunteer_user(row):
    """Map Neon volunteers row → res.users vals (minimal portal user)."""
    email = str_or_false(row.get("email"))
    name = str_or_false(row.get("full_name")) or "Unknown"
    return {
        "name": name,
        "login": email or f"volunteer_{row['id']}@sahyog.local",
        "email": email or False,
        "active": True,
    }


def map_volunteer_employee(row):
    """Map Neon volunteers row → hr.employee vals."""
    vals = {
        "name": str_or_false(row.get("full_name")) or "Unknown",
        "work_email": str_or_false(row.get("email")),
        "work_phone": str_or_false(row.get("phone")),
        "sex": _map_gender(row.get("gender")),
        "birthday": date_or_false(row.get("date_of_birth")),
        "base_status": _map_base_status(row.get("base_status")),
        "whatsapp_number": str_or_false(row.get("whatsapp_number")),
        "notes": str_or_false(row.get("notes")),
        "x_city": str_or_false(row.get("city")),
        "x_state": str_or_false(row.get("state")),
        "x_nationality": str_or_false(row.get("nationality")),
        "work_mode": _map_work_mode(row.get("work_mode")),
        "date_of_joining_isha": date_or_false(row.get("date_of_joining_isha")),
        "date_of_joining_guest_care": date_or_false(row.get("date_of_joining_guest_care")),
        "role_in_guest_care": str_or_false(row.get("role_in_guest_care")),
        "current_assignment_area": str_or_false(row.get("current_assignment_area")),
        "reporting_to_name": str_or_false(row.get("reporting_to_name")),
        "special_skills": str_or_false(row.get("special_skills")),
        "health_conditions": str_or_false(row.get("health_conditions")),
        "added_by": str_or_false(row.get("added_by")),
        "emergency_contact_name": str_or_false(row.get("emergency_contact_name")),
        "emergency_contact_phone": str_or_false(row.get("emergency_contact_phone")),
        "emergency_contact_relation": str_or_false(row.get("emergency_contact_relation")),
    }
    return vals


def _map_gender(val):
    """Map source gender to Odoo hr.employee gender selection."""
    if not val:
        return False
    g = str(val).strip().lower()
    if g in ("male", "m"):
        return "male"
    if g in ("female", "f"):
        return "female"
    if g == "other":
        return "other"
    return False


def _map_base_status(val):
    """Map source base_status to Odoo selection value."""
    if not val:
        return "available"
    s = str(val).strip().lower()
    mapping = {
        "available": "available",
        "break": "break",
        "away": "away",
        "left": "left",
    }
    return mapping.get(s, "available")


def _map_work_mode(val):
    """Map source work_mode to Odoo selection value."""
    if not val:
        return False
    w = str(val).strip().lower().replace(" ", "_")
    mapping = {
        "office": "office",
        "remote": "remote",
        "guest_care": "guest_care",
    }
    return mapping.get(w, False)


def map_silence_period(row):
    """Map Neon silence_periods row → sahyog.silence.period vals."""
    return {
        "volunteer_id": id_map["volunteers"].get(row.get("volunteer_id"), False),
        "start_date": date_or_false(row.get("start_date")),
        "end_date": date_or_false(row.get("end_date")),
        "silence_type": _map_silence_type(row.get("silence_type")),
        "status": _map_period_status(row.get("status")),
        "notes": str_or_false(row.get("notes")),
    }


def _map_silence_type(val):
    """Map source silence_type to Odoo selection."""
    if not val:
        return False
    s = str(val).strip().lower()
    mapping = {
        "personal": "personal",
        "9pm_9am": "9pm_9am",
        "9pm-9am": "9pm_9am",
        "9pm-9am silence": "9pm_9am",
        "program": "program",
        "program silence": "program",
    }
    return mapping.get(s, "personal")


def _map_period_status(val):
    """Map source status to Odoo period status selection."""
    if not val:
        return "approved"
    s = str(val).strip().lower()
    mapping = {
        "requested": "requested",
        "approved": "approved",
        "on_going": "on_going",
        "on going": "on_going",
        "ongoing": "on_going",
        "done": "done",
        "cancelled": "cancelled",
        "canceled": "cancelled",
        "pending_admin": "pending_admin",
        "pending admin": "pending_admin",
        "pending_volunteer": "pending_volunteer",
        "pending volunteer": "pending_volunteer",
    }
    return mapping.get(s, "approved")


def map_break_period(row):
    """Map Neon breaks row → sahyog.break.period vals."""
    return {
        "volunteer_id": id_map["volunteers"].get(row.get("volunteer_id"), False),
        "break_type": _map_break_type(row.get("break_type")),
        "start_date": date_or_false(row.get("start_date")),
        "end_date": date_or_false(row.get("end_date")),
        "reason": str_or_false(row.get("reason")),
        "status": _map_period_status(row.get("status")),
        "notes": str_or_false(row.get("notes")),
    }


def _map_break_type(val):
    """Map source break_type to Odoo selection."""
    if not val:
        return "personal"
    b = str(val).strip().lower().replace(" ", "_")
    mapping = {
        "personal": "personal",
        "health": "health",
        "family_emergency": "family_emergency",
        "family emergency": "family_emergency",
    }
    return mapping.get(b, "personal")


def map_program(row):
    """Map Neon programs row → sahyog.program vals."""
    return {
        "name": row["name"],
        "description": str_or_false(row.get("description")),
        "typical_duration_days": int_or_zero(row.get("typical_duration_days")),
        "gender": _map_program_gender(row.get("gender")),
        "program_type": _map_program_type(row.get("program_type")),
    }


def _map_program_gender(val):
    """Map source gender to Odoo program gender selection."""
    if not val:
        return False
    g = str(val).strip().lower()
    if g in ("male", "m"):
        return "male"
    if g in ("female", "f"):
        return "female"
    return False


def _map_program_type(val):
    """Map source program_type to Odoo selection."""
    if not val:
        return "main"
    t = str(val).strip().lower()
    mapping = {"main": "main", "silence": "silence", "other": "other"}
    return mapping.get(t, "main")


def map_program_schedule(row):
    """Map Neon program_schedules row → sahyog.program.schedule vals."""
    return {
        "program_id": id_map["programs"].get(row.get("program_id"), False),
        "start_date": date_or_false(row.get("start_date")),
        "end_date": date_or_false(row.get("end_date")),
        "start_time": str_or_false(row.get("start_time")),
        "end_time": str_or_false(row.get("end_time")),
        "is_recurring": bool_val(row.get("is_recurring")),
        "location": str_or_false(row.get("location")),
        "capacity": int_or_zero(row.get("capacity")),
        "fee": str_or_false(row.get("fee")),
        "schedule_status": _map_schedule_status(row.get("schedule_status")),
        "notes": str_or_false(row.get("notes")),
    }


def _map_schedule_status(val):
    """Map source schedule_status to Odoo selection."""
    if not val:
        return "planning"
    s = str(val).strip().lower()
    mapping = {"planning": "planning", "upcoming": "upcoming", "completed": "completed"}
    return mapping.get(s, "planning")


def map_volunteer_program(row):
    """Map Neon volunteer_programs row → sahyog.volunteer.program vals."""
    return {
        "volunteer_id": id_map["volunteers"].get(row.get("volunteer_id"), False),
        "program_id": id_map["programs"].get(row.get("program_id"), False),
        "participation_type": _map_participation_type(row.get("participation_type")),
        "start_date": date_or_false(row.get("start_date")),
        "end_date": date_or_false(row.get("end_date")),
        "location": str_or_false(row.get("location")),
        "completion_status": _map_completion_status(row.get("completion_status")),
        "notes": str_or_false(row.get("notes")),
    }


def _map_participation_type(val):
    """Map source participation_type to Odoo selection."""
    if not val:
        return "participant"
    p = str(val).strip().lower()
    mapping = {"participant": "participant", "volunteer": "volunteer"}
    return mapping.get(p, "participant")


def _map_completion_status(val):
    """Map source completion_status to Odoo selection."""
    if not val:
        return "upcoming"
    s = str(val).strip().lower().replace(" ", "_")
    mapping = {
        "done": "done",
        "upcoming": "upcoming",
        "dropped": "dropped",
        "pending_volunteer": "pending_volunteer",
        "pending_admin": "pending_admin",
    }
    return mapping.get(s, "upcoming")


def map_meeting(row):
    """Map Neon meetings row → sahyog.meeting vals."""
    return {
        "title": str_or_false(row.get("title")) or "Meeting",
        "volunteer_id": id_map["volunteers"].get(row.get("volunteer_id"), False),
        "meeting_with_id": id_map["volunteers"].get(row.get("meeting_with_id"), False),
        "date": date_or_false(row.get("date")),
        "start_time": str_or_false(row.get("start_time")) or "00:00",
        "end_time": str_or_false(row.get("end_time")) or "23:59",
        "location": str_or_false(row.get("location")),
        "notes": str_or_false(row.get("notes")),
        "status": _map_meeting_status(row.get("status")),
    }


def _map_meeting_status(val):
    """Map source meeting status to Odoo selection."""
    if not val:
        return "scheduled"
    s = str(val).strip().lower()
    mapping = {"scheduled": "scheduled", "completed": "completed", "cancelled": "cancelled"}
    return mapping.get(s, "scheduled")


def map_notification(row):
    """Map Neon notifications row → sahyog.notification vals."""
    return {
        "volunteer_id": id_map["volunteers"].get(row.get("volunteer_id"), False),
        "type": str_or_false(row.get("type")) or "info",
        "title": str_or_false(row.get("title")) or "Notification",
        "message": str_or_false(row.get("message")) or "",
        "is_read": bool_val(row.get("is_read")),
        "email_sent": bool_val(row.get("email_sent")),
    }


def map_registration_link(row):
    """Map Neon registration_links row → sahyog.registration.link vals."""
    return {
        "token": row["token"],
        "status": _map_link_status(row.get("status")),
        "expires_at": datetime_or_false(row.get("expires_at")),
        "used_by_volunteer_id": id_map["volunteers"].get(
            row.get("used_by_volunteer_id"), False
        ),
    }


def _map_link_status(val):
    """Map source registration link status to Odoo selection."""
    if not val:
        return "active"
    s = str(val).strip().lower()
    mapping = {"active": "active", "used": "used", "expired": "expired"}
    return mapping.get(s, "active")


def map_unavailability_slot(row):
    """Map Neon time_slot_unavailability row → sahyog.unavailability.slot vals."""
    return {
        "volunteer_id": id_map["volunteers"].get(row.get("volunteer_id"), False),
        "date": date_or_false(row.get("date")),
        "start_time": str_or_false(row.get("start_time")) or "00:00",
        "end_time": str_or_false(row.get("end_time")) or "23:59",
        "reason": str_or_false(row.get("reason")),
    }


# ═══════════════════════════════════════════════════════════════════════
# Migration logic per table
# ═══════════════════════════════════════════════════════════════════════

def migrate_sub_teams(conn, models, db, uid, pw, dry_run):
    """Migrate sub_teams → sahyog.sub.team."""
    table = "sub_teams"
    rows = fetch_all(conn, "SELECT * FROM sub_teams ORDER BY id")
    log.info("Migrating %d sub_teams...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            log.debug("sub_team %s already migrated, skipping", src_id)
            stats[table]["succeeded"] += 1
            continue

        try:
            # Idempotency: check if name already exists in Odoo
            existing = odoo_search(models, db, uid, pw, "sahyog.sub.team",
                                   [("name", "=", row["name"])])
            if existing:
                id_map[table][src_id] = existing[0]
                log.debug("sub_team '%s' already exists (id=%d)", row["name"], existing[0])
                stats[table]["succeeded"] += 1
                continue

            vals = map_sub_team(row)
            if dry_run:
                log.info("[DRY-RUN] Would create sub_team: %s", vals["name"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.sub.team", vals)
            id_map[table][src_id] = odoo_id
            log.debug("Created sub_team '%s' → id=%d", vals["name"], odoo_id)
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate sub_team id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_regions(conn, models, db, uid, pw, dry_run):
    """Migrate regions → sahyog.region (skip if already seeded)."""
    table = "regions"
    rows = fetch_all(conn, "SELECT * FROM regions ORDER BY id")
    log.info("Migrating %d regions...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            existing = odoo_search(models, db, uid, pw, "sahyog.region",
                                   [("name", "=", row["name"])])
            if existing:
                id_map[table][src_id] = existing[0]
                log.debug("region '%s' already exists (id=%d), skipping", row["name"], existing[0])
                stats[table]["succeeded"] += 1
                continue

            vals = map_region(row)
            if dry_run:
                log.info("[DRY-RUN] Would create region: %s", vals["name"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.region", vals)
            id_map[table][src_id] = odoo_id
            log.debug("Created region '%s' → id=%d", vals["name"], odoo_id)
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate region id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_volunteers(conn, models, db, uid, pw, dry_run):
    """Migrate volunteers → res.users + hr.employee."""
    table = "volunteers"
    rows = fetch_all(conn, "SELECT * FROM volunteers ORDER BY id")
    log.info("Migrating %d volunteers...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            email = str_or_false(row.get("email"))

            # Idempotency: check if employee with this email already exists
            if email:
                existing_emp = odoo_search(models, db, uid, pw, "hr.employee",
                                           [("work_email", "=", email)])
                if existing_emp:
                    id_map[table][src_id] = existing_emp[0]
                    log.debug("volunteer '%s' already exists (emp id=%d)", email, existing_emp[0])
                    stats[table]["succeeded"] += 1
                    continue

            if dry_run:
                log.info("[DRY-RUN] Would create volunteer: %s (%s)",
                         row.get("full_name"), email)
                stats[table]["succeeded"] += 1
                continue

            # 1. Create res.users (portal user)
            user_vals = map_volunteer_user(row)
            # Check if user with this login already exists
            existing_user = odoo_search(models, db, uid, pw, "res.users",
                                        [("login", "=", user_vals["login"])])
            if existing_user:
                user_id = existing_user[0]
                log.debug("res.users '%s' already exists (id=%d)", user_vals["login"], user_id)
            else:
                user_id = odoo_create(models, db, uid, pw, "res.users", user_vals)
                log.debug("Created res.users '%s' → id=%d", user_vals["login"], user_id)

            id_map["users"][src_id] = user_id

            # 2. Create hr.employee linked to the user
            emp_vals = map_volunteer_employee(row)
            emp_vals["user_id"] = user_id

            # Link sub_team if present
            sub_team_id_src = row.get("sub_team_id")
            if sub_team_id_src and sub_team_id_src in id_map["sub_teams"]:
                emp_vals["sub_team_id"] = id_map["sub_teams"][sub_team_id_src]

            # Link region if present
            region_id_src = row.get("region_id")
            if region_id_src and region_id_src in id_map["regions"]:
                emp_vals["region_id"] = id_map["regions"][region_id_src]

            # Handle volunteer_types (text[] in source → Many2many tags in Odoo)
            volunteer_types = row.get("volunteer_types")
            if volunteer_types:
                type_ids = _get_or_create_volunteer_types(
                    models, db, uid, pw, volunteer_types,
                )
                if type_ids:
                    emp_vals["volunteer_type_ids"] = [(6, 0, type_ids)]

            odoo_emp_id = odoo_create(models, db, uid, pw, "hr.employee", emp_vals)
            id_map[table][src_id] = odoo_emp_id
            log.debug("Created hr.employee '%s' → id=%d", emp_vals["name"], odoo_emp_id)
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate volunteer id=%s (%s): %s",
                      src_id, row.get("full_name"), e)
            stats[table]["failed"] += 1


def _get_or_create_volunteer_types(models, db, uid, pw, types_list):
    """Get or create sahyog.volunteer.type records for a list of type names.

    types_list can be a Python list (from psycopg2 array) or a string.
    """
    if isinstance(types_list, str):
        # Handle comma-separated or PostgreSQL array literal
        types_list = [t.strip().strip("{}\"'") for t in types_list.split(",") if t.strip()]

    odoo_ids = []
    for type_name in types_list:
        type_name = str(type_name).strip()
        if not type_name:
            continue
        existing = odoo_search(models, db, uid, pw, "sahyog.volunteer.type",
                               [("name", "=", type_name)])
        if existing:
            odoo_ids.append(existing[0])
        else:
            new_id = odoo_create(models, db, uid, pw, "sahyog.volunteer.type",
                                 {"name": type_name})
            odoo_ids.append(new_id)
    return odoo_ids


def migrate_silence_periods(conn, models, db, uid, pw, dry_run):
    """Migrate silence_periods → sahyog.silence.period."""
    table = "silence_periods"
    rows = fetch_all(conn, "SELECT * FROM silence_periods ORDER BY id")
    log.info("Migrating %d silence_periods...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            vals = map_silence_period(row)
            if not vals["volunteer_id"]:
                log.warning("silence_period id=%s: volunteer_id %s not found in id_map, skipping",
                            src_id, row.get("volunteer_id"))
                stats[table]["failed"] += 1
                continue

            if dry_run:
                log.info("[DRY-RUN] Would create silence_period for volunteer odoo_id=%s",
                         vals["volunteer_id"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.silence.period", vals)
            id_map[table][src_id] = odoo_id
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate silence_period id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_breaks(conn, models, db, uid, pw, dry_run):
    """Migrate breaks → sahyog.break.period."""
    table = "breaks"
    rows = fetch_all(conn, "SELECT * FROM breaks ORDER BY id")
    log.info("Migrating %d breaks...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            vals = map_break_period(row)
            if not vals["volunteer_id"]:
                log.warning("break id=%s: volunteer_id %s not found in id_map, skipping",
                            src_id, row.get("volunteer_id"))
                stats[table]["failed"] += 1
                continue

            if dry_run:
                log.info("[DRY-RUN] Would create break_period for volunteer odoo_id=%s",
                         vals["volunteer_id"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.break.period", vals)
            id_map[table][src_id] = odoo_id
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate break id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_programs(conn, models, db, uid, pw, dry_run):
    """Migrate programs → sahyog.program."""
    table = "programs"
    rows = fetch_all(conn, "SELECT * FROM programs ORDER BY id")
    log.info("Migrating %d programs...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            existing = odoo_search(models, db, uid, pw, "sahyog.program",
                                   [("name", "=", row["name"])])
            if existing:
                id_map[table][src_id] = existing[0]
                log.debug("program '%s' already exists (id=%d)", row["name"], existing[0])
                stats[table]["succeeded"] += 1
                continue

            vals = map_program(row)
            if dry_run:
                log.info("[DRY-RUN] Would create program: %s", vals["name"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.program", vals)
            id_map[table][src_id] = odoo_id
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate program id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_program_schedules(conn, models, db, uid, pw, dry_run):
    """Migrate program_schedules → sahyog.program.schedule."""
    table = "program_schedules"
    rows = fetch_all(conn, "SELECT * FROM program_schedules ORDER BY id")
    log.info("Migrating %d program_schedules...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            vals = map_program_schedule(row)
            if not vals["program_id"]:
                log.warning("program_schedule id=%s: program_id %s not found, skipping",
                            src_id, row.get("program_id"))
                stats[table]["failed"] += 1
                continue

            if dry_run:
                log.info("[DRY-RUN] Would create program_schedule for program odoo_id=%s",
                         vals["program_id"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.program.schedule", vals)
            id_map[table][src_id] = odoo_id
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate program_schedule id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_volunteer_programs(conn, models, db, uid, pw, dry_run):
    """Migrate volunteer_programs → sahyog.volunteer.program."""
    table = "volunteer_programs"
    rows = fetch_all(conn, "SELECT * FROM volunteer_programs ORDER BY id")
    log.info("Migrating %d volunteer_programs...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            vals = map_volunteer_program(row)
            if not vals["volunteer_id"]:
                log.warning("volunteer_program id=%s: volunteer_id %s not found, skipping",
                            src_id, row.get("volunteer_id"))
                stats[table]["failed"] += 1
                continue
            if not vals["program_id"]:
                log.warning("volunteer_program id=%s: program_id %s not found, skipping",
                            src_id, row.get("program_id"))
                stats[table]["failed"] += 1
                continue

            if dry_run:
                log.info("[DRY-RUN] Would create volunteer_program vol=%s prog=%s",
                         vals["volunteer_id"], vals["program_id"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.volunteer.program", vals)
            id_map[table][src_id] = odoo_id
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate volunteer_program id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_meetings(conn, models, db, uid, pw, dry_run):
    """Migrate meetings → sahyog.meeting."""
    table = "meetings"
    rows = fetch_all(conn, "SELECT * FROM meetings ORDER BY id")
    log.info("Migrating %d meetings...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            vals = map_meeting(row)
            if not vals["volunteer_id"]:
                log.warning("meeting id=%s: volunteer_id %s not found, skipping",
                            src_id, row.get("volunteer_id"))
                stats[table]["failed"] += 1
                continue
            if not vals["meeting_with_id"]:
                log.warning("meeting id=%s: meeting_with_id %s not found, skipping",
                            src_id, row.get("meeting_with_id"))
                stats[table]["failed"] += 1
                continue

            if dry_run:
                log.info("[DRY-RUN] Would create meeting: %s", vals["title"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.meeting", vals)
            id_map[table][src_id] = odoo_id
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate meeting id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_notifications(conn, models, db, uid, pw, dry_run):
    """Migrate notifications → sahyog.notification."""
    table = "notifications"
    rows = fetch_all(conn, "SELECT * FROM notifications ORDER BY id")
    log.info("Migrating %d notifications...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            vals = map_notification(row)
            if not vals["volunteer_id"]:
                log.warning("notification id=%s: volunteer_id %s not found, skipping",
                            src_id, row.get("volunteer_id"))
                stats[table]["failed"] += 1
                continue

            # Mark email_sent=True so Odoo doesn't re-send migrated notifications
            vals["email_sent"] = True

            if dry_run:
                log.info("[DRY-RUN] Would create notification: %s", vals["title"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.notification", vals)
            id_map[table][src_id] = odoo_id
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate notification id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_registration_links(conn, models, db, uid, pw, dry_run):
    """Migrate registration_links → sahyog.registration.link."""
    table = "registration_links"
    rows = fetch_all(conn, "SELECT * FROM registration_links ORDER BY id")
    log.info("Migrating %d registration_links...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            # Idempotency: check by token
            existing = odoo_search(models, db, uid, pw, "sahyog.registration.link",
                                   [("token", "=", row["token"])])
            if existing:
                id_map[table][src_id] = existing[0]
                stats[table]["succeeded"] += 1
                continue

            vals = map_registration_link(row)
            if dry_run:
                log.info("[DRY-RUN] Would create registration_link: %s", vals["token"][:8])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.registration.link", vals)
            id_map[table][src_id] = odoo_id
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate registration_link id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def migrate_unavailability_slots(conn, models, db, uid, pw, dry_run):
    """Migrate time_slot_unavailability → sahyog.unavailability.slot."""
    table = "time_slot_unavailability"
    rows = fetch_all(conn, "SELECT * FROM time_slot_unavailability ORDER BY id")
    log.info("Migrating %d time_slot_unavailability...", len(rows))

    for row in rows:
        stats[table]["processed"] += 1
        src_id = row["id"]

        if src_id in id_map[table]:
            stats[table]["succeeded"] += 1
            continue

        try:
            vals = map_unavailability_slot(row)
            if not vals["volunteer_id"]:
                log.warning("unavailability id=%s: volunteer_id %s not found, skipping",
                            src_id, row.get("volunteer_id"))
                stats[table]["failed"] += 1
                continue

            if dry_run:
                log.info("[DRY-RUN] Would create unavailability_slot for volunteer odoo_id=%s",
                         vals["volunteer_id"])
                stats[table]["succeeded"] += 1
                continue

            odoo_id = odoo_create(models, db, uid, pw, "sahyog.unavailability.slot", vals)
            id_map[table][src_id] = odoo_id
            stats[table]["succeeded"] += 1
        except Exception as e:
            log.error("Failed to migrate unavailability id=%s: %s", src_id, e)
            stats[table]["failed"] += 1


def update_sub_team_leads(conn, models, db, uid, pw, dry_run):
    """Second pass: set team_lead_id on sub_teams now that volunteers are migrated."""
    rows = fetch_all(conn, "SELECT id, team_lead_id FROM sub_teams WHERE team_lead_id IS NOT NULL")
    for row in rows:
        src_id = row["id"]
        lead_src = row["team_lead_id"]
        odoo_team_id = id_map["sub_teams"].get(src_id)
        odoo_lead_id = id_map["volunteers"].get(lead_src)
        if odoo_team_id and odoo_lead_id and not dry_run:
            try:
                models.execute_kw(
                    db, uid, pw, "sahyog.sub.team", "write",
                    [[odoo_team_id], {"team_lead_id": odoo_lead_id}],
                )
                log.debug("Updated sub_team %d team_lead_id → %d", odoo_team_id, odoo_lead_id)
            except Exception as e:
                log.error("Failed to update sub_team %d team_lead: %s", odoo_team_id, e)


# ═══════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════

def print_summary():
    """Print migration summary table."""
    print("\n" + "=" * 65)
    print("MIGRATION SUMMARY")
    print("=" * 65)
    print(f"{'Table':<30} {'Processed':>10} {'Succeeded':>10} {'Failed':>8}")
    print("-" * 65)

    total_p, total_s, total_f = 0, 0, 0
    table_order = [
        "sub_teams", "regions", "volunteers", "silence_periods", "breaks",
        "programs", "program_schedules", "volunteer_programs", "meetings",
        "notifications", "registration_links", "time_slot_unavailability",
    ]
    for table in table_order:
        s = stats[table]
        print(f"{table:<30} {s['processed']:>10} {s['succeeded']:>10} {s['failed']:>8}")
        total_p += s["processed"]
        total_s += s["succeeded"]
        total_f += s["failed"]

    print("-" * 65)
    print(f"{'TOTAL':<30} {total_p:>10} {total_s:>10} {total_f:>8}")
    print("=" * 65)

    if total_f > 0:
        print(f"\n⚠  {total_f} record(s) failed. Check logs above for details.")
    else:
        print("\n✓  All records migrated successfully.")


def main():
    parser = argparse.ArgumentParser(
        description="Migrate data from Neon PostgreSQL to Odoo 19 (Sahyog module)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate migration without creating records in Odoo",
    )
    args = parser.parse_args()

    if args.dry_run:
        log.info("=== DRY-RUN MODE — no records will be created in Odoo ===")

    # Connect to both databases
    conn = neon_connect()
    uid, models, db, pw = odoo_connect()

    try:
        # Migrate in dependency order
        migrate_sub_teams(conn, models, db, uid, pw, args.dry_run)
        migrate_regions(conn, models, db, uid, pw, args.dry_run)
        migrate_volunteers(conn, models, db, uid, pw, args.dry_run)

        # Second pass: update sub_team team_lead_id now that volunteers exist
        update_sub_team_leads(conn, models, db, uid, pw, args.dry_run)

        migrate_silence_periods(conn, models, db, uid, pw, args.dry_run)
        migrate_breaks(conn, models, db, uid, pw, args.dry_run)
        migrate_programs(conn, models, db, uid, pw, args.dry_run)
        migrate_program_schedules(conn, models, db, uid, pw, args.dry_run)
        migrate_volunteer_programs(conn, models, db, uid, pw, args.dry_run)
        migrate_meetings(conn, models, db, uid, pw, args.dry_run)
        migrate_notifications(conn, models, db, uid, pw, args.dry_run)
        migrate_registration_links(conn, models, db, uid, pw, args.dry_run)
        migrate_unavailability_slots(conn, models, db, uid, pw, args.dry_run)
    finally:
        conn.close()

    print_summary()


if __name__ == "__main__":
    main()
