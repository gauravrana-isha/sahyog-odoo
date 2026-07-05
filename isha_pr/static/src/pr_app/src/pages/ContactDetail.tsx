import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Stack, Card, Text, Group, Badge, Button, Select, Textarea, TextInput,
  Divider, Loader, Center, Timeline, Alert, Switch, Avatar, ActionIcon,
  TagsInput, Image, SimpleGrid, Box, FileButton, Accordion,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft, IconHome, IconMessagePlus, IconCamera, IconTrash, IconDeviceFloppy,
} from '@tabler/icons-react';
import { apiGet, apiPost } from '../api';
import { usePR } from '../hooks/usePR';
import type { ContactDetail as Detail, Interaction } from '../types';

const INVOLVEMENT = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];
const GENDERS = [
  { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const SOURCES = [
  { value: 'event', label: 'Event' }, { value: 'referral', label: 'Referral' },
  { value: 'web', label: 'Web' }, { value: 'social', label: 'Social Media' },
  { value: 'other', label: 'Other' },
];
const IMAGE_KINDS = [
  { value: 'card_front', label: 'Card — Front' },
  { value: 'card_back', label: 'Card — Back' },
  { value: 'id', label: 'ID Document' },
  { value: 'other', label: 'Other' },
];
const TYPES = [
  { value: 'meeting', label: 'Meeting' }, { value: 'call', label: 'Call' },
  { value: 'event', label: 'Event' }, { value: 'email', label: 'Email' },
  { value: 'message', label: 'Message' }, { value: 'other', label: 'Other' },
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const empty = {
  name: '', pr_alternate_name: '', email: '', pr_secondary_email: '',
  phone: '', pr_secondary_phone: '', pr_whatsapp: '', pr_gender: '',
  pr_involvement: '', pr_source: '', function: '', company_name: '',
  street: '', city: '', zip: '', comment: '', pr_poc_notes: '',
  pr_vip: false, pr_met_sadhguru: false, pr_follows_sg: false,
};

export function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { center } = usePR();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({ ...empty });
  const [programs, setPrograms] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [progOpts, setProgOpts] = useState<string[]>([]);
  const [campOpts, setCampOpts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [imgKind, setImgKind] = useState('card_front');
  const [interaction, setInteraction] = useState({ interaction_type: 'meeting', subject: '', notes: '' });
  const [logging, setLogging] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiGet<Detail>(`/contacts/${id}`)
      .then((d) => {
        setData(d);
        setF({
          name: d.name, pr_alternate_name: d.alternate_name, email: d.email,
          pr_secondary_email: d.secondary_email, phone: d.phone,
          pr_secondary_phone: d.secondary_phone, pr_whatsapp: d.whatsapp,
          pr_gender: d.gender, pr_involvement: d.pr_involvement, pr_source: d.source,
          function: d.function, company_name: d.company_name, street: d.street,
          city: d.city, zip: d.zip, comment: d.notes, pr_poc_notes: d.poc_notes,
          pr_vip: d.vip, pr_met_sadhguru: d.met_sadhguru, pr_follows_sg: d.follows_sg,
        });
        setPrograms(d.programs.map((p) => p.name));
        setCampaigns(d.campaigns.map((c) => c.name));
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiGet<{ id: number; name: string }[]>('/programs').then((r) => setProgOpts(r.map((x) => x.name))).catch(() => {});
    apiGet<{ id: number; name: string }[]>('/campaigns').then((r) => setCampOpts(r.map((x) => x.name))).catch(() => {});
  }, []);

  const set = (k: string, v: unknown) => setF((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const d = await apiPost<Detail>(`/contacts/${id}/update`, {
        ...f, program_names: programs, campaign_names: campaigns,
      });
      setData(d);
      notifications.show({ color: 'green', message: 'Saved' });
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally { setSaving(false); }
  };

  const uploadPortrait = async (file: File | null) => {
    if (!file) return;
    const image_1920 = await fileToBase64(file);
    await apiPost(`/contacts/${id}/update`, { image_1920 });
    load();
  };

  const addGalleryImage = async (file: File | null) => {
    if (!file) return;
    const image = await fileToBase64(file);
    await apiPost(`/contacts/${id}/images`, { image, kind: imgKind });
    load();
  };

  const deleteImage = async (imageId: number) => {
    await apiPost(`/images/${imageId}/delete`, {});
    load();
  };

  const logInteraction = async () => {
    if (!center) { notifications.show({ color: 'red', message: 'Select a center first.' }); return; }
    setLogging(true);
    try {
      await apiPost<Interaction>('/interactions/create', {
        partner_id: Number(id), center_id: center.id, ...interaction,
      });
      setInteraction({ interaction_type: 'meeting', subject: '', notes: '' });
      load();
    } catch (e) {
      notifications.show({ color: 'red', message: (e as Error).message });
    } finally { setLogging(false); }
  };

  if (loading) return <Center py="xl"><Loader /></Center>;
  if (!data) return <Text c="dimmed" ta="center" py="xl">Contact not found.</Text>;

  return (
    <Stack pb={80}>
      <Group justify="space-between">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/contacts')} px={4}>Back</Button>
        <Button color="grape" leftSection={<IconDeviceFloppy size={16} />}
          loading={saving} onClick={save}>Save</Button>
      </Group>

      {/* Portrait + name */}
      <Group>
        <Stack gap={4} align="center">
          <Avatar src={data.portrait_url} size={72} radius="xl" color="grape">
            {data.name.slice(0, 1)}
          </Avatar>
          <FileButton onChange={uploadPortrait} accept="image/*">
            {(props) => (
              <Button {...props} size="compact-xs" variant="subtle"
                leftSection={<IconCamera size={12} />}>Photo</Button>
            )}
          </FileButton>
        </Stack>
        <Stack gap={4} flex={1}>
          <TextInput value={f.name} onChange={(e) => set('name', e.currentTarget.value)}
            placeholder="Name" />
          <Group gap="xs">
            <Switch label="VIP" checked={f.pr_vip}
              onChange={(e) => set('pr_vip', e.currentTarget.checked)} />
            {data.guest_summary.visit_count > 0 &&
              <Badge color="teal" variant="light">Guest ×{data.guest_summary.visit_count}</Badge>}
          </Group>
        </Stack>
      </Group>

      {/* Guest Care history (summary-only, via shared person) */}
      {data.guest_summary.visit_count > 0 && (
        <Alert color="teal" icon={<IconHome size={18} />} title="Guest Care history" p="xs">
          Hosted <b>{data.guest_summary.visit_count}</b> time(s).
          {data.guest_summary.last_visit && (
            <> Last: {data.guest_summary.last_visit.arrival_date}
              {data.guest_summary.last_visit.center ? ` · ${data.guest_summary.last_visit.center}` : ''}.</>
          )}
        </Alert>
      )}

      <Accordion defaultValue="involvement" variant="separated">
        <Accordion.Item value="involvement">
          <Accordion.Control>Involvement</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Select label="Involvement level" data={INVOLVEMENT} value={f.pr_involvement}
                onChange={(v) => set('pr_involvement', v || '')} clearable />
              <Select label="Source" data={SOURCES} value={f.pr_source}
                onChange={(v) => set('pr_source', v || '')} clearable />
              <Switch label="Met Sadhguru? (SGO Contact)" checked={f.pr_met_sadhguru}
                onChange={(e) => set('pr_met_sadhguru', e.currentTarget.checked)} />
              <Switch label="Follows SG?" checked={f.pr_follows_sg}
                onChange={(e) => set('pr_follows_sg', e.currentTarget.checked)} />
              <TagsInput label="Programs" data={progOpts} value={programs}
                onChange={setPrograms} placeholder="Type to add…" />
              <TagsInput label="Campaigns" data={campOpts} value={campaigns}
                onChange={setCampaigns} placeholder="Type to add…" />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="contact">
          <Accordion.Control>Contact & occupation</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <TextInput label="Alternate name" value={f.pr_alternate_name}
                onChange={(e) => set('pr_alternate_name', e.currentTarget.value)} />
              <Select label="Gender" data={GENDERS} value={f.pr_gender}
                onChange={(v) => set('pr_gender', v || '')} clearable />
              <TextInput label="Email" value={f.email}
                onChange={(e) => set('email', e.currentTarget.value)} />
              <TextInput label="Secondary email" value={f.pr_secondary_email}
                onChange={(e) => set('pr_secondary_email', e.currentTarget.value)} />
              <TextInput label="Phone" value={f.phone}
                onChange={(e) => set('phone', e.currentTarget.value)} />
              <TextInput label="Secondary phone" value={f.pr_secondary_phone}
                onChange={(e) => set('pr_secondary_phone', e.currentTarget.value)} />
              <TextInput label="WhatsApp" value={f.pr_whatsapp}
                onChange={(e) => set('pr_whatsapp', e.currentTarget.value)} />
              <TextInput label="Designation" value={f.function}
                onChange={(e) => set('function', e.currentTarget.value)} />
              <TextInput label="Organization" value={f.company_name}
                onChange={(e) => set('company_name', e.currentTarget.value)} />
              <TextInput label="Address" value={f.street}
                onChange={(e) => set('street', e.currentTarget.value)} />
              <Group grow>
                <TextInput label="City" value={f.city}
                  onChange={(e) => set('city', e.currentTarget.value)} />
                <TextInput label="Zip" value={f.zip}
                  onChange={(e) => set('zip', e.currentTarget.value)} />
              </Group>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="poc">
          <Accordion.Control>Point of contact & notes</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              {data.primary_poc && (
                <Badge variant="light">Primary POC: {data.primary_poc.name}</Badge>
              )}
              <Textarea label="POC notes" placeholder="Name / details when we don't have a full contact yet"
                autosize minRows={2} value={f.pr_poc_notes}
                onChange={(e) => set('pr_poc_notes', e.currentTarget.value)} />
              <Textarea label="Notes" autosize minRows={2} value={f.comment}
                onChange={(e) => set('comment', e.currentTarget.value)} />
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>

        <Accordion.Item value="images">
          <Accordion.Control>Images / documents ({data.images.length})</Accordion.Control>
          <Accordion.Panel>
            <Stack gap="xs">
              <Group>
                <Select data={IMAGE_KINDS} value={imgKind}
                  onChange={(v) => setImgKind(v || 'other')} w={160} />
                <FileButton onChange={addGalleryImage} accept="image/*">
                  {(props) => (
                    <Button {...props} variant="light" leftSection={<IconCamera size={16} />}>
                      Add image
                    </Button>
                  )}
                </FileButton>
              </Group>
              <SimpleGrid cols={3} spacing="xs">
                {data.images.map((img) => (
                  <Box key={img.id} pos="relative">
                    <Image src={img.url} radius="sm" h={90} fit="cover" />
                    <ActionIcon color="red" size="xs" variant="filled"
                      style={{ position: 'absolute', top: 2, right: 2 }}
                      onClick={() => deleteImage(img.id)}>
                      <IconTrash size={12} />
                    </ActionIcon>
                    <Text size="10px" c="dimmed" ta="center">
                      {IMAGE_KINDS.find((k) => k.value === img.kind)?.label || img.kind}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>
            </Stack>
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>

      {/* Log interaction */}
      <Divider label="Log an interaction" />
      <Card withBorder>
        <Stack gap="xs">
          <Select data={TYPES} value={interaction.interaction_type}
            onChange={(v) => setInteraction({ ...interaction, interaction_type: v || 'meeting' })} />
          <TextInput placeholder="Subject" value={interaction.subject}
            onChange={(e) => setInteraction({ ...interaction, subject: e.currentTarget.value })} />
          <Textarea placeholder="Notes" autosize minRows={2} value={interaction.notes}
            onChange={(e) => setInteraction({ ...interaction, notes: e.currentTarget.value })} />
          <Text size="xs" c="dimmed">Logging in center: <b>{center?.name || 'none'}</b></Text>
          <Button color="grape" leftSection={<IconMessagePlus size={16} />}
            loading={logging} onClick={logInteraction}>Log</Button>
        </Stack>
      </Card>

      <Divider label={`Interactions (${data.interactions.length})`} />
      {data.interactions.length === 0 ? (
        <Text c="dimmed" size="sm">No interactions in your center(s) yet.</Text>
      ) : (
        <Timeline active={data.interactions.length} bulletSize={16} lineWidth={2}>
          {data.interactions.map((i) => (
            <Timeline.Item key={i.id} title={i.subject || i.interaction_type}>
              <Text size="xs" c="dimmed">{i.date} · {i.center_id?.name} · {i.owner}</Text>
              {i.notes && <Text size="sm" mt={2}>{i.notes}</Text>}
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </Stack>
  );
}
