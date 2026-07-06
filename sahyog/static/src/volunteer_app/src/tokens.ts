/**
 * Sahyog design tokens — the single source of truth for semantic colors.
 *
 * Palette definitions live in theme.ts. Pages and components must reference
 * these tokens (never raw hexes or palette names inline) so both color
 * schemes and any future rebrand stay coherent.
 */

export type EntryType = 'silence' | 'break' | 'program' | 'unavailability';

/** Mantine palette name per calendar/history entry type (badges, accents). */
export const ENTRY_TYPE_COLOR: Record<EntryType, string> = {
  program: 'sage',
  silence: 'river',
  break: 'ochre',
  unavailability: 'sand',
};

/** Solid fill per entry type for Gantt bars and legend dots. */
export const ENTRY_TYPE_FILL: Record<string, string> = {
  program: 'var(--mantine-color-sage-6)',
  silence: 'var(--mantine-color-river-6)',
  break: 'var(--mantine-color-ochre-6)',
  unavailability: 'var(--mantine-color-sand-6)',
};

/** Program category → palette name. */
export const PROGRAM_TYPE_COLOR: Record<string, string> = {
  main: 'clay',
  hatha: 'sage',
  silence: 'river',
  other: 'sand',
};

/** Request/enrollment status → palette name. Pending = ochre, active = clay,
 *  positive = sage, informational = river, terminal-neutral = sand. */
export const STATUS_COLOR: Record<string, string> = {
  requested: 'ochre',
  pending_admin: 'ochre',
  pending_volunteer: 'ochre',
  approved: 'sage',
  upcoming: 'river',
  on_going: 'clay',
  done: 'sand',
  completed: 'sand',
  cancelled: 'red',
  dropped: 'red',
};

/** Guest visit state → palette name. */
export const GUEST_STATE_COLOR: Record<string, string> = {
  complete: 'sage',
  draft: 'ochre',
};

/** Star-rating fills (scheme-aware). */
export const STAR_FILLED = 'var(--mantine-color-ochre-4)';
export const STAR_EMPTY =
  'light-dark(var(--mantine-color-sand-2), var(--mantine-color-dark-4))';

/** "Today" marker line in the calendar Gantt. */
export const TODAY_LINE = 'var(--mantine-color-clay-6)';
