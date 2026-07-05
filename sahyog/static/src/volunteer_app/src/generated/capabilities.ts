// AUTO-GENERATED from sahyog/api_contract.py — do not edit by hand.
// Regenerate: python3 sahyog/scripts/gen_ts_types.py


export interface Capabilities {
  view_programs: boolean;
  view_history: boolean;
  view_guests: boolean;
  submit_requests: boolean;
  view_calendar: boolean;
  view_profile: boolean;
  admin: boolean;
}

export const CAPABILITY_KEYS = [
  'view_programs',
  'view_history',
  'view_guests',
  'submit_requests',
  'view_calendar',
  'view_profile',
  'admin',
] as const;
