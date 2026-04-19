import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Text,
  Badge,
  Stack,
  Group,
  Skeleton,
  Alert,
  Button,
  Accordion,
  TextInput,
  Textarea,
  Select,
  NumberInput,
  MultiSelect,
  SimpleGrid,
  Card,
  Center,
  ActionIcon,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconEdit,
  IconX,
  IconMoodEmpty,
} from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { apiGet, apiPost } from '../api';
import type { GuestVisit, GuestFeedbackEntry, GuestPlace } from '../types';
import { QRCodeDisplay } from '../components/QRCodeDisplay';

function fmtDate(d: string) {
  try { return format(parseISO(d), 'MMM d, yyyy'); }
  catch { return d; }
}

function Field({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <Box>
      <Text size="xs" c="dimmed" mb={2}>{label}</Text>
      <Text size="sm">{value || '—'}</Text>
    </Box>
  );
}

function StarRating({ rating }: { rating: string | undefined }) {
  const num = parseInt(rating || '0', 10);
  return (
    <Text size="sm">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= num ? '#f59f00' : '#dee2e6' }}>★</span>
      ))}
      {num > 0 && <span style={{ marginLeft: 4, color: 'var(--mantine-color-dimmed)' }}>{num}/5</span>}
    </Text>
  );
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'group', label: 'Group' },
];

const COMPANY_SECTOR_OPTIONS = [
  { value: 'entertainment_art_culture', label: 'Entertainment, Art and Culture' },
  { value: 'government_bureaucrats', label: 'Government, Bureaucrats & Intergovernmental Organization' },
  { value: 'corporate_business', label: 'Corporate / Business' },
  { value: 'education_academia', label: 'Education / Academia' },
  { value: 'healthcare_medical', label: 'Healthcare / Medical' },
  { value: 'legal', label: 'Legal' },
  { value: 'media_journalism', label: 'Media / Journalism' },
  { value: 'ngo_nonprofit', label: 'NGO / Non-Profit' },
  { value: 'sports', label: 'Sports' },
  { value: 'technology', label: 'Technology' },
  { value: 'religious_spiritual', label: 'Religious / Spiritual Leaders' },
  { value: 'diplomats', label: 'Diplomats / Ambassadors' },
  { value: 'other', label: 'Other' },
];

const ACCOMMODATION_OPTIONS = [
  { value: 'nalanda_presidential', label: 'Nalanda Presidential Suite' },
  { value: 'nalanda_suite', label: 'Nalanda Suite' },
  { value: 'nalanda_room', label: 'Nalanda Room' },
  { value: 'ananda_suite', label: 'Ananda Suite' },
  { value: 'ananda_room', label: 'Ananda Room' },
  { value: 'guest_house', label: 'Guest House' },
  { value: 'cottage', label: 'Cottage' },
  { value: 'day_visit', label: 'Day Visit' },
  { value: 'other', label: 'Other' },
];

const EXPERIENCE_RATING_OPTIONS = [
  { value: '1', label: '1 — Poor' },
  { value: '2', label: '2 — Fair' },
  { value: '3', label: '3 — Good' },
  { value: '4', label: '4 — Very Good' },
  { value: '5', label: '5 — Excellent' },
];

interface EditableFields {
  main_guest_name: string;
  gender: string | null;
  designation_company: string;
  company_sector: string | null;
  phone: string;
  email: string;
  address: string;
  arrival_date: Date | null;
  departure_date: Date | null;
  accommodation_type: string | null;
  reference_of: string;
  poc_name: string;
  poc_contact: string;
  place_event_ids: string[];
  accompanying_guest_count: number;
  experience_rating: string | null;
  experience_details: string;
  action_required: string;
  compliments_offered: string;
  other_remarks: string;
}

function visitToEditable(v: GuestVisit): EditableFields {
  return {
    main_guest_name: v.main_guest_name || '',
    gender: v.gender || null,
    designation_company: v.designation_company || '',
    company_sector: v.company_sector || null,
    phone: v.phone || '',
    email: v.email || '',
    address: v.address || '',
    arrival_date: v.arrival_date ? parseISO(v.arrival_date) : null,
    departure_date: v.departure_date ? parseISO(v.departure_date) : null,
    accommodation_type: v.accommodation_type || null,
    reference_of: v.reference_of || '',
    poc_name: v.poc_name || '',
    poc_contact: v.poc_contact || '',
    place_event_ids: v.place_event_ids ? v.place_event_ids.map((p) => String(p.id)) : [],
    accompanying_guest_count: v.accompanying_guest_count || 0,
    experience_rating: v.experience_rating || null,
    experience_details: v.experience_details || '',
    action_required: v.action_required || '',
    compliments_offered: v.compliments_offered || '',
    other_remarks: v.other_remarks || '',
  };
}

export function GuestVisitDetail() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 768px)');

  const [visit, setVisit] = useState<GuestVisit | null>(null);
  const [feedback, setFeedback] = useState<GuestFeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState<EditableFields | null>(null);
  const [initial, setInitial] = useState<EditableFields | null>(null);

  const [places, setPlaces] = useState<GuestPlace[]>([]);

  const fetchVisit = useCallback(() => {
    if (!visitId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<GuestVisit>(`/guest-visits/${visitId}`),
      apiGet<GuestFeedbackEntry[]>(`/guest-visits/${visitId}/feedback`),
      apiGet<GuestPlace[]>('/guest-places'),
    ])
      .then(([v, fb, pl]) => {
        setVisit(v);
        setFeedback(fb);
        setPlaces(pl);
        const fields = visitToEditable(v);
        setEditable(fields);
        setInitial(fields);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [visitId]);

  useEffect(() => { fetchVisit(); }, [fetchVisit]);

  const placeOptions = useMemo(
    () => places.map((p) => ({ value: String(p.id), label: p.name })),
    [places]
  );

  const set = <K extends keyof EditableFields>(field: K, value: EditableFields[K]) =>
    setEditable((prev) => prev ? { ...prev, [field]: value } : prev);

  const isDirty = useMemo(() => {
    if (!editable || !initial) return false;
    const keys = Object.keys(initial) as (keyof EditableFields)[];
    return keys.some((k) => {
      const a = editable[k];
      const b = initial[k];
      if (a instanceof Date && b instanceof Date) return a.getTime() !== b.getTime();
      if (a instanceof Date || b instanceof Date) return true;
      if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) !== JSON.stringify(b);
      return a !== b;
    });
  }, [editable, initial]);

  const handleSave = async () => {
    if (!editable || !visitId) return;
    setSaving(true);
    try {
      const fmtD = (d: Date | null) => d ? format(d, 'yyyy-MM-dd') : false;
      const payload: Record<string, unknown> = {
        main_guest_name: editable.main_guest_name,
        gender: editable.gender || false,
        designation_company: editable.designation_company,
        company_sector: editable.company_sector || false,
        phone: editable.phone,
        email: editable.email,
        address: editable.address,
        arrival_date: fmtD(editable.arrival_date),
        departure_date: fmtD(editable.departure_date),
        accommodation_type: editable.accommodation_type || false,
        reference_of: editable.reference_of,
        poc_name: editable.poc_name,
        poc_contact: editable.poc_contact,
        place_event_ids: editable.place_event_ids.map(Number),
        accompanying_guest_count: editable.accompanying_guest_count,
        experience_rating: editable.experience_rating || false,
        experience_details: editable.experience_details,
        action_required: editable.action_required,
        compliments_offered: editable.compliments_offered,
        other_remarks: editable.other_remarks,
      };
      await apiPost(`/guest-visits/${visitId}/update`, payload);
      setEditing(false);
      fetchVisit();
      notifications.show({ title: 'Saved', message: 'Guest visit updated.', color: 'green' });
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to save',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    if (initial) setEditable({ ...initial });
  };

  if (loading) {
    return (
      <Box style={{ maxWidth: isWide ? 700 : undefined, margin: isWide ? '0 auto' : undefined }}>
        <Skeleton height={30} width={200} mb="md" />
        <Skeleton height={200} radius="md" mb="md" />
        {[1, 2, 3].map((i) => <Skeleton key={i} height={48} radius="md" mb="xs" />)}
      </Box>
    );
  }

  if (error) {
    return (
      <Box style={{ maxWidth: isWide ? 700 : undefined, margin: isWide ? '0 auto' : undefined }}>
        <Alert icon={<IconAlertCircle size={16} />} color="red">{error}</Alert>
      </Box>
    );
  }

  if (!visit || !editable) return null;

  const sectorLabel = COMPANY_SECTOR_OPTIONS.find((o) => o.value === visit.company_sector)?.label || visit.company_sector;
  const accomLabel = ACCOMMODATION_OPTIONS.find((o) => o.value === visit.accommodation_type)?.label || visit.accommodation_type;

  return (
    <Box style={{ maxWidth: isWide ? 700 : undefined, margin: isWide ? '0 auto' : undefined, paddingBottom: editing && isDirty ? 80 : 0 }}>
      {/* Header */}
      <Group mb="md" gap="sm">
        <ActionIcon variant="subtle" size="lg" onClick={() => navigate(-1)} aria-label="Go back">
          <IconArrowLeft size={22} />
        </ActionIcon>
        <Box style={{ flex: 1 }}>
          <Text fw={600} size="lg">{visit.main_guest_name}</Text>
        </Box>
        <Badge variant="light" color={visit.state === 'complete' ? 'green' : 'orange'}>
          {visit.state}
        </Badge>
      </Group>

      {/* QR Code */}
      {visit.feedback_link && (
        <Center mb="md">
          <QRCodeDisplay feedbackLink={visit.feedback_link} qrExpiry={visit.qr_expiry} />
        </Center>
      )}

      {/* VIEW MODE */}
      {!editing && (
        <>
          <Accordion variant="separated" defaultValue="guest-details">
            <Accordion.Item value="guest-details">
              <Accordion.Control>Guest Details</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  <Field label="Gender" value={visit.gender ? GENDER_OPTIONS.find((o) => o.value === visit.gender)?.label || visit.gender : undefined} />
                  <Field label="Designation & Company" value={visit.designation_company} />
                  <Field label="Company Sector" value={sectorLabel} />
                  <Field label="Phone" value={visit.phone} />
                  <Field label="Email" value={visit.email} />
                  <Field label="Address" value={visit.address} />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="visit-details">
              <Accordion.Control>Visit Details</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  <Field label="Arrival Date" value={visit.arrival_date ? fmtDate(visit.arrival_date) : undefined} />
                  <Field label="Departure Date" value={visit.departure_date ? fmtDate(visit.departure_date) : undefined} />
                  <Field label="Accommodation" value={accomLabel} />
                  <Field label="Reference Of" value={visit.reference_of} />
                  <Field label="POC Name" value={visit.poc_name} />
                  <Field label="POC Contact" value={visit.poc_contact} />
                  <Box>
                    <Text size="xs" c="dimmed" mb={2}>Places / Events Attended</Text>
                    <Group gap="xs">
                      {visit.place_event_ids && visit.place_event_ids.length > 0
                        ? visit.place_event_ids.map((p) => <Badge key={p.id} variant="light" size="sm">{p.name}</Badge>)
                        : <Text size="sm" c="dimmed">—</Text>}
                    </Group>
                  </Box>
                  <Field label="Accompanying Guest Count" value={String(visit.accompanying_guest_count ?? 0)} />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="experience">
              <Accordion.Control>Experience</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  <Box>
                    <Text size="xs" c="dimmed" mb={2}>Experience Rating</Text>
                    <StarRating rating={visit.experience_rating} />
                  </Box>
                  <Field label="Experience Details" value={visit.experience_details} />
                  <Field label="Action Required" value={visit.action_required} />
                  <Field label="Compliments Offered" value={visit.compliments_offered} />
                  <Field label="Other Remarks" value={visit.other_remarks} />
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            <Accordion.Item value="sync-status">
              <Accordion.Control>Sync Status</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xs">
                  <Box>
                    <Text size="xs" c="dimmed" mb={2}>Google Form Synced</Text>
                    <Badge variant="light" color={visit.google_form_synced ? 'green' : 'red'}>
                      {visit.google_form_synced ? 'Synced' : 'Not Synced'}
                    </Badge>
                  </Box>
                  {visit.google_form_error && (
                    <Field label="Sync Error" value={visit.google_form_error} />
                  )}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>

          <Button
            variant="light"
            leftSection={<IconEdit size={16} />}
            mt="md"
            fullWidth
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        </>
      )}

      {/* EDIT MODE */}
      {editing && (
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Editing Guest Visit</Text>
            <Button variant="subtle" color="gray" size="xs" leftSection={<IconX size={14} />} onClick={handleCancel}>
              Cancel
            </Button>
          </Group>

          <Text size="sm" fw={500} c="dimmed">Guest Details</Text>
          <TextInput label="Guest Name" value={editable.main_guest_name} onChange={(e) => set('main_guest_name', e.currentTarget.value)} size="md" />
          <Select label="Gender" placeholder="Select" data={GENDER_OPTIONS} value={editable.gender} onChange={(v) => set('gender', v)} size="md" clearable />
          <TextInput label="Designation & Company" value={editable.designation_company} onChange={(e) => set('designation_company', e.currentTarget.value)} size="md" />
          <Select label="Company Sector" placeholder="Select" data={COMPANY_SECTOR_OPTIONS} value={editable.company_sector} onChange={(v) => set('company_sector', v)} size="md" searchable clearable />
          <TextInput label="Phone" value={editable.phone} onChange={(e) => set('phone', e.currentTarget.value)} size="md" />
          <TextInput label="Email" value={editable.email} onChange={(e) => set('email', e.currentTarget.value)} size="md" />
          <Textarea label="Address" value={editable.address} onChange={(e) => set('address', e.currentTarget.value)} minRows={2} autosize size="md" />

          <Text size="sm" fw={500} c="dimmed" mt="sm">Visit Details</Text>
          <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
            <DateInput label="Arrival Date" placeholder="Pick date" value={editable.arrival_date} onChange={(v) => set('arrival_date', v)} size="md" />
            <DateInput label="Departure Date" placeholder="Pick date" value={editable.departure_date} onChange={(v) => set('departure_date', v)} size="md" minDate={editable.arrival_date || undefined} />
          </SimpleGrid>
          <Select label="Accommodation" placeholder="Select" data={ACCOMMODATION_OPTIONS} value={editable.accommodation_type} onChange={(v) => set('accommodation_type', v)} size="md" clearable />
          <TextInput label="Reference Of" value={editable.reference_of} onChange={(e) => set('reference_of', e.currentTarget.value)} size="md" />
          <TextInput label="POC Name" value={editable.poc_name} onChange={(e) => set('poc_name', e.currentTarget.value)} size="md" />
          <TextInput label="POC Contact" value={editable.poc_contact} onChange={(e) => set('poc_contact', e.currentTarget.value)} size="md" />
          <MultiSelect label="Places / Events Attended" placeholder="Select places" data={placeOptions} value={editable.place_event_ids} onChange={(val) => set('place_event_ids', val)} searchable size="md" />
          <NumberInput label="Accompanying Guest Count" value={editable.accompanying_guest_count} onChange={(v) => set('accompanying_guest_count', typeof v === 'number' ? v : 0)} min={0} size="md" />

          <Text size="sm" fw={500} c="dimmed" mt="sm">Experience</Text>
          <Select label="Experience Rating" placeholder="Select" data={EXPERIENCE_RATING_OPTIONS} value={editable.experience_rating} onChange={(v) => set('experience_rating', v)} size="md" clearable />
          <Textarea label="Experience Details" value={editable.experience_details} onChange={(e) => set('experience_details', e.currentTarget.value)} minRows={2} autosize size="md" />
          <Textarea label="Action Required" value={editable.action_required} onChange={(e) => set('action_required', e.currentTarget.value)} minRows={2} autosize size="md" />
          <Textarea label="Compliments Offered" value={editable.compliments_offered} onChange={(e) => set('compliments_offered', e.currentTarget.value)} minRows={2} autosize size="md" />
          <Textarea label="Other Remarks" value={editable.other_remarks} onChange={(e) => set('other_remarks', e.currentTarget.value)} minRows={2} autosize size="md" />

          <Group mt="md">
            <Button flex={1} size="md" loading={saving} onClick={handleSave} disabled={!isDirty}>
              Save
            </Button>
            <Button flex={1} variant="light" color="gray" size="md" onClick={handleCancel}>
              Cancel
            </Button>
          </Group>
        </Stack>
      )}

      {/* Feedback Section */}
      <Text fw={600} size="md" mt="xl" mb="sm">Guest Feedback</Text>
      {feedback.length === 0 ? (
        <Center py="lg">
          <Stack align="center" gap="xs">
            <IconMoodEmpty size={40} color="var(--mantine-color-gray-4)" />
            <Text c="dimmed" size="sm">No feedback received yet</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="sm">
          {feedback.map((fb) => (
            <Card key={fb.id} padding="sm" withBorder shadow="xs">
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={600}>{fb.guest_name}</Text>
                <StarRating rating={fb.overall_rating} />
              </Group>
              {fb.enjoyed_most && (
                <Box mt={4}>
                  <Text size="xs" c="dimmed">Enjoyed Most</Text>
                  <Text size="sm">{fb.enjoyed_most}</Text>
                </Box>
              )}
              {fb.could_be_improved && (
                <Box mt={4}>
                  <Text size="xs" c="dimmed">Could Be Improved</Text>
                  <Text size="sm">{fb.could_be_improved}</Text>
                </Box>
              )}
              {fb.additional_comments && (
                <Box mt={4}>
                  <Text size="xs" c="dimmed">Additional Comments</Text>
                  <Text size="sm">{fb.additional_comments}</Text>
                </Box>
              )}
              {fb.create_date && (
                <Text size="xs" c="dimmed" mt={4}>
                  {fmtDate(fb.create_date)}
                </Text>
              )}
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
