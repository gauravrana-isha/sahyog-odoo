/**
 * PR app semantic color tokens (Earthen Warmth design language, shared with
 * the Sahyog volunteer app). Palette definitions live in theme.ts — pages
 * must reference these tokens, never palette names or hexes inline.
 */

/** VIP contacts — gold-adjacent warm amber. */
export const VIP_COLOR = 'ochre';

/** PR involvement level badge. */
export const INVOLVEMENT_COLOR = 'river';

/** Guest-care linkage (visits hosted) — matches the guest color in Sahyog. */
export const GUEST_LINK_COLOR = 'clay';

/** Nomination pipeline stage → palette name. */
export const STAGE_COLOR: Record<string, string> = {
  nominated: 'ochre',
  researched: 'river',
  approved: 'sage',
  nurturing: 'clay',
  rejected: 'red',
};

/** Nomination tier → palette name (1 = priority lead). */
export const TIER_COLOR: Record<string, string> = {
  '1': 'sage',
  '2': 'ochre',
  '3': 'sand',
};
