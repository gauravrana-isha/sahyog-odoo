export interface Center {
  id: number;
  name: string;
}

export interface PRCapabilities {
  pr_view_dashboard: boolean;
  pr_view_contacts: boolean;
  pr_log_interaction: boolean;
  pr_view_nominations: boolean;
  pr_view_followups: boolean;
  admin: boolean;
}

export interface PRMe {
  user: { id: number; name: string; login: string };
  groups: { pr: boolean; global: boolean; admin: boolean };
  centers: Center[];
  regions: Ref[];
  can: PRCapabilities;
}

export interface Ref {
  id: number;
  name: string;
}

export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  pr_involvement: string;
  is_pr_contact: boolean;
  vip: boolean;
  interaction_count: number;
  image_url: string | null;
}

export interface Interaction {
  id: number;
  partner_id: Ref | null;
  center_id: Ref | null;
  date: string;
  interaction_type: string;
  subject: string;
  notes: string;
  follow_up_date: string;
  owner: string;
}

export interface GuestSummary {
  visit_count: number;
  last_visit: { arrival_date: string; center: string } | null;
}

export interface ContactImage {
  id: number;
  kind: string;
  label: string;
  url: string;
}

export interface NominationLight {
  id: number;
  nominee: string;
  nominee_id: number;
  stage: string;
  stage_label: string;
  tier: string;
  vertical: string;
  vertical_label: string;
  leadership_position: string;
  organization: string;
  high_priority: boolean;
  is_self_nomination: boolean;
  submission_date: string;
  image_url: string | null;
}

export interface NominationOutreach {
  id: number;
  campaign: string;
  status: string;
  notes: string;
}

export interface Nomination extends NominationLight {
  tier_confidence: number;
  tier_rationale: string;
  sources: string;
  website: string;
  linkedin: string;
  instagram: string;
  social_following: string;
  social_links: string;
  location: string;
  is_meditator: string;
  ie_or_shambhavi: string;
  follows_sadhguru: string;
  research_status: string;
  research_volunteer: string;
  research_recommendation: string;
  research_notes: string;
  enriched: boolean;
  approval_status: string;
  approval_detail: string;
  approver: string;
  poc: string;
  next_step: string;
  brief: string;
  last_touch: string;
  email: string;
  phone: string;
  nominated_for: string;
  proceed_preference: string;
  influence_examples: string;
  nominator_name: string;
  nominator_email: string;
  nominator_phone: string;
  outreach: NominationOutreach[];
}

export interface ContactDetail extends Contact {
  alternate_name: string;
  secondary_email: string;
  secondary_phone: string;
  whatsapp: string;
  gender: string;
  function: string;
  company_name: string;
  street: string;
  street2: string;
  city: string;
  zip: string;
  region_id: Ref | null;
  source: string;
  source_detail: string;
  social_links: string;
  met_sadhguru: string;
  follows_sg: boolean;
  owner: Ref | null;
  tags: Ref[];
  notes: string;
  programs: Ref[];
  campaigns: Ref[];
  related: Ref[];
  primary_poc: { id: number; name: string; email: string } | null;
  secondary_poc: { id: number; name: string; email: string } | null;
  primary_poc_email: string;
  secondary_poc_email: string;
  poc_notes: string;
  images: ContactImage[];
  has_portrait: boolean;
  portrait_url: string | null;
  last_interaction: string;
  next_followup: string;
  interactions: Interaction[];
  guest_summary: GuestSummary;
}

export interface DashboardData {
  total: number;
  priority_leads: number;
  nurturing: number;
  needs_review: number;
  with_outreach: number;
  to_research: number;
  by_stage: Record<string, number>;
  by_tier: Record<string, number>;
  top_verticals: { vertical: string; label: string; count: number }[];
}
