import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Avatar,
  Text,
  Badge,
  Accordion,
  TextInput,
  Textarea,
  Skeleton,
  Stack,
  Group,
  Alert,
  Button,
  Affix,
  Transition,
  ActionIcon,
  Modal,
  Image,
  CloseButton,
  MultiSelect,
  Select,
} from '@mantine/core';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle, IconCamera, IconEdit, IconX } from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import type { VolunteerProfile, VolunteerType } from '../types';

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function Field({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <Box>
      <Text size="xs" c="dimmed" mb={2}>{label}</Text>
      <Text size="sm">{value || '—'}</Text>
    </Box>
  );
}

interface EditableFields {
  work_phone: string;
  whatsapp_number: string;
  x_city: string;
  x_state: string;
  x_nationality: string;
  special_skills: string;
  health_conditions: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  language_ids: string[];
  volunteer_type_ids: string[];
  region_id: string | null;
  center_id: string | null;
}

export function ProfilePage() {
  const isWide = useMediaQuery('(min-width: 768px)');
  const [profile, setProfile] = useState<VolunteerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoModalOpened, { open: openPhotoModal, close: closePhotoModal }] = useDisclosure(false);

  // Dropdown options
  const [allLanguages, setAllLanguages] = useState<{ id: number; name: string }[]>([]);
  const [allVolunteerTypes, setAllVolunteerTypes] = useState<VolunteerType[]>([]);
  const [allRegions, setAllRegions] = useState<{ id: number; name: string }[]>([]);
  const [allCenters, setAllCenters] = useState<{ id: number; name: string }[]>([]);

  const [editable, setEditable] = useState<EditableFields>({
    work_phone: '', whatsapp_number: '', x_city: '', x_state: '', x_nationality: '',
    special_skills: '', health_conditions: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
    language_ids: [], volunteer_type_ids: [],
    region_id: null, center_id: null,
  });
  const [initial, setInitial] = useState<EditableFields>({ ...editable });

  const fetchProfile = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet<VolunteerProfile>('/profile'),
      apiGet<{ id: number; name: string }[]>('/languages'),
      apiGet<VolunteerType[]>('/volunteer-types'),
      apiGet<{ id: number; name: string }[]>('/regions'),
      apiGet<{ id: number; name: string }[]>('/centers'),
    ])
      .then(([data, langs, vtypes, regions, centers]) => {
        setProfile(data);
        setAllLanguages(langs);
        setAllVolunteerTypes(vtypes);
        setAllRegions(regions);
        setAllCenters(centers);
        const f: EditableFields = {
          work_phone: data.work_phone || '',
          whatsapp_number: data.whatsapp_number || '',
          x_city: data.x_city || '',
          x_state: data.x_state || '',
          x_nationality: data.x_nationality || '',
          special_skills: data.special_skills || '',
          health_conditions: data.health_conditions || '',
          emergency_contact_name: data.emergency_contact_name || '',
          emergency_contact_phone: data.emergency_contact_phone || '',
          emergency_contact_relation: data.emergency_contact_relation || '',
          language_ids: data.language_ids.map((l) => String(l.id)),
          volunteer_type_ids: data.volunteer_type_ids.map((v) => String(v.id)),
          region_id: data.region_id ? String(data.region_id.id) : null,
          center_id: data.center_id ? String(data.center_id.id) : null,
        };
        setEditable(f);
        setInitial(f);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const isDirty = useMemo(() => {
    const keys = Object.keys(initial) as (keyof EditableFields)[];
    return keys.some((k) => {
      const a = editable[k];
      const b = initial[k];
      if (Array.isArray(a) && Array.isArray(b)) return JSON.stringify(a) !== JSON.stringify(b);
      return a !== b;
    });
  }, [editable, initial]);

  const set = (field: keyof EditableFields, value: string | string[] | null) =>
    setEditable((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiPost('/profile/update', {
        work_phone: editable.work_phone,
        whatsapp_number: editable.whatsapp_number,
        x_city: editable.x_city,
        x_state: editable.x_state,
        x_nationality: editable.x_nationality,
        special_skills: editable.special_skills,
        health_conditions: editable.health_conditions,
        emergency_contact_name: editable.emergency_contact_name,
        emergency_contact_phone: editable.emergency_contact_phone,
        emergency_contact_relation: editable.emergency_contact_relation,
        language_ids: editable.language_ids.map(Number),
        volunteer_type_ids: editable.volunteer_type_ids.map(Number),
        region_id: editable.region_id ? Number(editable.region_id) : false,
        center_id: editable.center_id ? Number(editable.center_id) : false,
      });
      setInitial({ ...editable });
      setEditing(false);
      fetchProfile();
      notifications.show({ title: 'Saved', message: 'Profile updated.', color: 'green' });
    } catch (err) {
      notifications.show({ title: 'Error', message: err instanceof Error ? err.message : 'Failed', color: 'red' });
    } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await apiPost('/profile/photo', { image: base64 });
      notifications.show({ title: 'Photo Updated', message: 'Your profile photo has been updated.', color: 'green' });
      fetchProfile();
    } catch (err) {
      notifications.show({ title: 'Error', message: err instanceof Error ? err.message : 'Upload failed', color: 'red' });
    } finally { setUploading(false); }
  };

  const langOptions = allLanguages.map((l) => ({ value: String(l.id), label: l.name }));
  const vtypeOptions = allVolunteerTypes.map((v) => ({ value: String(v.id), label: v.name }));
  const regionOptions = allRegions.map((r) => ({ value: String(r.id), label: r.name }));
  const centerOptions = allCenters.map((c) => ({ value: String(c.id), label: c.name }));

  if (loading) {
    return (
      <Box style={{ maxWidth: isWide ? 600 : undefined, margin: isWide ? '0 auto' : undefined }}>
        <Stack align="center" gap="sm" mb="lg">
          <Skeleton circle height={80} />
          <Skeleton height={20} width={160} />
        </Stack>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={48} radius="md" mb="xs" />)}
      </Box>
    );
  }

  if (error) return <Alert icon={<IconAlertCircle size={16} />} color="red">{error}</Alert>;
  if (!profile) return null;

  const statusColor =
    profile.computed_status === 'Available' ? 'green' :
    profile.computed_status === 'On Silence' ? 'violet' :
    profile.computed_status === 'On Break' ? 'orange' :
    profile.computed_status === 'On Program' ? 'blue' : 'gray';

  const avatarUrl = profile.id ? `/web/image/hr.employee/${profile.id}/avatar_128` : undefined;
  const fullResUrl = profile.id ? `/web/image/hr.employee/${profile.id}/image_1920` : undefined;

  return (
    <Box style={{ maxWidth: isWide ? 600 : undefined, margin: isWide ? '0 auto' : undefined, paddingBottom: editing && isDirty ? 80 : 0 }}>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(file); e.target.value = ''; }} />

      <Modal opened={photoModalOpened} onClose={closePhotoModal} fullScreen withCloseButton={false} padding={0}
        styles={{ body: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: 'rgba(0,0,0,0.9)' } }}>
        <CloseButton size="lg" variant="transparent" c="white" style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }} onClick={closePhotoModal} aria-label="Close" />
        {fullResUrl && <Image src={fullResUrl} alt={profile.name} fit="contain" style={{ maxHeight: '90vh', maxWidth: '90vw' }} />}
      </Modal>

      <Stack align="center" gap="xs" mb="lg">
        <Box style={{ position: 'relative' }}>
          <Avatar size={80} radius="xl" src={avatarUrl} color="blue" style={{ cursor: 'pointer', opacity: uploading ? 0.5 : 1 }} onClick={openPhotoModal}>
            {getInitials(profile.name)}
          </Avatar>
          <ActionIcon size={28} radius="xl" variant="filled" color="gray"
            style={{ position: 'absolute', bottom: -2, right: -2, border: '2px solid #fff' }}
            onClick={() => fileRef.current?.click()} loading={uploading} aria-label="Upload photo">
            <IconCamera size={14} />
          </ActionIcon>
        </Box>
        <Text size="xl" fw={600}>{profile.name}</Text>
        {profile.computed_status && <Badge variant="light" size="lg" color={statusColor}>{profile.computed_status}</Badge>}
      </Stack>

      {/* ── VIEW MODE ── */}
      {!editing && (
        <Accordion variant="separated" defaultValue="contact">
          <Accordion.Item value="contact">
            <Accordion.Control>Contact</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Field label="Email" value={profile.work_email} />
                <Field label="Phone" value={editable.work_phone} />
                <Field label="WhatsApp" value={editable.whatsapp_number} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="personal">
            <Accordion.Control>Personal</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Field label="Gender" value={profile.sex} />
                <Field label="Birthday" value={profile.birthday} />
                <Field label="Nationality" value={editable.x_nationality} />
                <Field label="City" value={editable.x_city} />
                <Field label="State" value={editable.x_state} />
                <Field label="Region" value={profile.region_id?.name} />
                <Field label="Center" value={profile.center_id?.name} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="languages">
            <Accordion.Control>Languages & Skills</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Box>
                  <Text size="xs" c="dimmed" mb={2}>Languages</Text>
                  <Group gap="xs">
                    {profile.language_ids.length > 0
                      ? profile.language_ids.map((l) => <Badge key={l.id} variant="light" size="sm">{l.name}</Badge>)
                      : <Text size="sm" c="dimmed">—</Text>}
                  </Group>
                </Box>
                <Field label="Special Skills" value={editable.special_skills} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="health">
            <Accordion.Control>Health</Accordion.Control>
            <Accordion.Panel>
              <Field label="Health Conditions" value={editable.health_conditions} />
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="volunteer-info">
            <Accordion.Control>Volunteer Info</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Box>
                  <Text size="xs" c="dimmed" mb={2}>Volunteer Types</Text>
                  <Group gap="xs">
                    {profile.volunteer_type_ids.length > 0
                      ? profile.volunteer_type_ids.map((v) => <Badge key={v.id} variant="light" size="sm">{v.name}</Badge>)
                      : <Text size="sm" c="dimmed">—</Text>}
                  </Group>
                </Box>
                <Field label="Date of Joining Isha" value={profile.date_of_joining_isha} />
                <Field label="Date of Joining Guest Care" value={profile.date_of_joining_guest_care} />
                <Field label="Added By" value={profile.added_by} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="emergency">
            <Accordion.Control>Emergency Contact</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="xs">
                <Field label="Name" value={editable.emergency_contact_name} />
                <Field label="Phone" value={editable.emergency_contact_phone} />
                <Field label="Relation" value={editable.emergency_contact_relation} />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      )}

      {/* ── EDIT MODE ── */}
      {editing && (
        <Stack gap="md">
          <Group justify="space-between">
            <Text fw={600}>Editing Profile</Text>
            <Button variant="subtle" color="gray" size="xs" leftSection={<IconX size={14} />}
              onClick={() => { setEditing(false); setEditable({ ...initial }); }}>Cancel</Button>
          </Group>

          <Text size="sm" fw={500} c="dimmed">Contact</Text>
          <TextInput label="Phone" value={editable.work_phone} onChange={(e) => set('work_phone', e.currentTarget.value)} size="md" />
          <TextInput label="WhatsApp" value={editable.whatsapp_number} onChange={(e) => set('whatsapp_number', e.currentTarget.value)} size="md" />

          <Text size="sm" fw={500} c="dimmed" mt="sm">Personal</Text>
          <TextInput label="Nationality" value={editable.x_nationality} onChange={(e) => set('x_nationality', e.currentTarget.value)} size="md" />
          <TextInput label="City" value={editable.x_city} onChange={(e) => set('x_city', e.currentTarget.value)} size="md" />
          <TextInput label="State" value={editable.x_state} onChange={(e) => set('x_state', e.currentTarget.value)} size="md" />
          <Select label="Region" placeholder="Select region" data={regionOptions} value={editable.region_id} onChange={(v) => set('region_id', v ?? null)} size="md" searchable clearable />
          <Select label="Center" placeholder="Select center" data={centerOptions} value={editable.center_id} onChange={(v) => set('center_id', v ?? null)} size="md" searchable clearable />

          <Text size="sm" fw={500} c="dimmed" mt="sm">Languages & Skills</Text>
          <MultiSelect label="Languages" placeholder="Select languages" data={langOptions} value={editable.language_ids}
            onChange={(val) => set('language_ids', val)} searchable size="md" />
          <Textarea label="Special Skills" value={editable.special_skills} onChange={(e) => set('special_skills', e.currentTarget.value)} minRows={2} autosize size="md" />

          <Text size="sm" fw={500} c="dimmed" mt="sm">Health</Text>
          <Textarea label="Health Conditions" value={editable.health_conditions} onChange={(e) => set('health_conditions', e.currentTarget.value)} minRows={2} autosize size="md" />

          <Text size="sm" fw={500} c="dimmed" mt="sm">Volunteer Info</Text>
          <MultiSelect label="Volunteer Types" placeholder="Select types" data={vtypeOptions} value={editable.volunteer_type_ids}
            onChange={(val) => set('volunteer_type_ids', val)} searchable size="md" />

          <Text size="sm" fw={500} c="dimmed" mt="sm">Emergency Contact</Text>
          <TextInput label="Name" value={editable.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.currentTarget.value)} size="md" />
          <TextInput label="Phone" value={editable.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.currentTarget.value)} size="md" />
          <TextInput label="Relation" value={editable.emergency_contact_relation} onChange={(e) => set('emergency_contact_relation', e.currentTarget.value)} size="md" />
        </Stack>
      )}

      {!editing && (
        <Affix position={{ bottom: 24, right: 24 }}>
          <ActionIcon size={56} radius="xl" variant="filled" color="blue" onClick={() => setEditing(true)} aria-label="Edit profile">
            <IconEdit size={24} />
          </ActionIcon>
        </Affix>
      )}

      <Affix position={{ bottom: 20, left: 16, right: 16 }}>
        <Transition mounted={editing && isDirty} transition="slide-up">
          {(styles) => (
            <Button fullWidth size="md" loading={saving} onClick={handleSave} style={styles}>Save Changes</Button>
          )}
        </Transition>
      </Affix>
    </Box>
  );
}
