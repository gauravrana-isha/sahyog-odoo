import { useState } from 'react';
import {
  Modal,
  TextInput,
  Button,
  Stack,
  Center,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { apiPost } from '../api';
import type { GuestVisit } from '../types';
import { QRCodeDisplay } from './QRCodeDisplay';

interface QuickCreateModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function QuickCreateModal({ opened, onClose, onCreated }: QuickCreateModalProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<GuestVisit | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      notifications.show({ title: 'Error', message: 'Please enter a guest name', color: 'red' });
      return;
    }
    setLoading(true);
    try {
      const visit = await apiPost<GuestVisit>('/guest-visits/create', { main_guest_name: name.trim() });
      setCreated(visit);
      onCreated();
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to create guest visit',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setCreated(null);
    setLoading(false);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="New Guest Visit" centered>
      {!created ? (
        <Stack gap="md">
          <TextInput
            label="Guest Name"
            placeholder="Enter guest name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            size="md"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
          <Button fullWidth size="md" loading={loading} onClick={handleCreate}>
            Create &amp; Get QR
          </Button>
        </Stack>
      ) : (
        <Stack gap="md" align="center">
          <Center>
            <QRCodeDisplay feedbackLink={created.feedback_link} qrExpiry={created.qr_expiry} />
          </Center>
          <Button fullWidth variant="light" size="md" onClick={handleClose}>
            Done
          </Button>
        </Stack>
      )}
    </Modal>
  );
}
