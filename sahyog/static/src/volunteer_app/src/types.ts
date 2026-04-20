export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface VolunteerProfile {
  id: number;
  name: string;
  work_email: string;
  work_phone: string;
  whatsapp_number: string;
  computed_status: string;
  base_status: string;
  work_mode: string;
  sub_team_id: { id: number; name: string } | null;
  role_in_guest_care: string;
  current_assignment_area: string;
  reporting_to_name: string;
  sex: string;
  birthday: string;
  x_nationality: string;
  x_city: string;
  x_state: string;
  region_id: { id: number; name: string } | null;
  center_id: { id: number; name: string } | null;
  language_ids: { id: number; name: string }[];
  volunteer_type_ids: { id: number; name: string }[];
  sadhana_practice_ids: { id: number; name: string }[];
  special_skills: string;
  health_conditions: string;
  date_of_joining_isha: string;
  date_of_joining_guest_care: string;
  added_by: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
}

export interface SilencePeriod {
  id: number;
  start_date: string;
  end_date: string;
  silence_type: 'personal' | '9pm_9am' | 'program';
  status: string;
  notes: string;
  is_recurring: boolean;
  start_time: string;
  end_time: string;
}

export interface BreakPeriod {
  id: number;
  start_date: string;
  end_date: string;
  break_type: 'personal' | 'health' | 'family_emergency';
  status: string;
  reason: string;
  notes: string;
  is_recurring: boolean;
  start_time: string;
  end_time: string;
}

export interface ProgramEnrollment {
  id: number;
  program_name: string;
  participation_type: 'participant' | 'volunteer';
  start_date: string;
  end_date: string;
  location: string;
  completion_status: string;
  notes: string;
}

export interface AvailableProgram {
  id: number;
  name: string;
  description: string;
  typical_duration_days: number;
  gender: string | null;
  program_type: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  create_date: string;
}

export interface UnavailabilitySlot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
}

export interface CalendarEntry {
  id: number;
  volunteer_id: number;
  entry_type: 'silence' | 'break' | 'program' | 'unavailability';
  name: string;
  start_date: string;
  end_date: string;
  status: string;
}

export interface CalendarData {
  volunteers: { id: number; name: string; volunteer_type_ids: number[] }[];
  entries: CalendarEntry[];
}

export interface VolunteerType {
  id: number;
  name: string;
}

export interface DashboardData {
  status: string;
  completed_programs: number;
  upcoming_silences: SilencePeriod[];
  upcoming_breaks: BreakPeriod[];
  upcoming_programs: ProgramEnrollment[];
}

export interface ProgramSchedule {
  id: number;
  program_id: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  location: string;
  capacity: number;
  schedule_status: string;
}

export interface Meeting {
  id: number;
  title: string;
  volunteer_id: { id: number; name: string };
  meeting_with_id: { id: number; name: string };
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  status: string;
}

export interface GuestVisit {
  id: number;
  main_guest_name: string;
  arrival_date: string;
  departure_date: string;
  state: 'draft' | 'complete';
  feedback_count: number;
  qr_token: string;
  feedback_link: string;
  qr_expiry: string;
  google_form_synced: boolean;
  volunteer_id: { id: number; name: string } | null;
  region_id: { id: number; name: string } | null;
  center_id: { id: number; name: string } | null;
  // Full fields (only in detail view)
  gender?: string;
  designation_company?: string;
  company_sector?: string;
  phone?: string;
  email?: string;
  address?: string;
  guest_region?: string;
  accommodation_type?: string;
  reference_of?: string;
  poc_name?: string;
  poc_contact?: string;
  place_event_ids?: { id: number; name: string }[];
  places_other?: string;
  accompanying_guest_count?: number;
  experience_rating?: string;
  experience_details?: string;
  action_required?: string;
  compliments_offered?: string;
  other_remarks?: string;
  submitter_email?: string;
  google_form_error?: string;
}

export interface GuestFeedbackEntry {
  id: number;
  guest_name: string;
  contact_phone: string;
  contact_email: string;
  overall_rating: string;
  enjoyed_most: string;
  could_be_improved: string;
  interested_in_programs: boolean;
  want_to_know_initiatives: boolean;
  would_visit_again: string;
  additional_comments: string;
  create_date: string;
}

export interface GuestPlace {
  id: number;
  name: string;
}
