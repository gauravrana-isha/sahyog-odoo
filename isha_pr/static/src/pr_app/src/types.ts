export interface Center {
  id: number;
  name: string;
}

export interface PRCapabilities {
  pr_view_contacts: boolean;
  pr_log_interaction: boolean;
  pr_view_events: boolean;
  admin: boolean;
}

export interface PRMe {
  user: { id: number; name: string; login: string };
  groups: { pr: boolean; global: boolean; admin: boolean };
  centers: Center[];
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
  met_sadhguru: boolean;
  follows_sg: boolean;
  owner: Ref | null;
  tags: Ref[];
  notes: string;
  programs: Ref[];
  campaigns: Ref[];
  related: Ref[];
  primary_poc: { id: number; name: string; email: string } | null;
  secondary_poc: { id: number; name: string; email: string } | null;
  poc_notes: string;
  images: ContactImage[];
  has_portrait: boolean;
  portrait_url: string | null;
  last_interaction: string;
  next_followup: string;
  interactions: Interaction[];
  guest_summary: GuestSummary;
}
