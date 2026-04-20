import { useState } from 'react';
import { Box, Button, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCopy, IconX } from '@tabler/icons-react';

interface QRCodeDisplayProps {
  feedbackLink: string;
  qrExpiry: string;
}

export function QRCodeDisplay({ feedbackLink, qrExpiry }: QRCodeDisplayProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const isExpired = qrExpiry ? new Date() > new Date(qrExpiry) : false;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(feedbackLink)}`;
  const qrUrlLarge = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(feedbackLink)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedbackLink);
      notifications.show({ title: 'Copied', message: 'Feedback link copied to clipboard', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to copy link', color: 'red' });
    }
  };

  return (
    <>
      <Stack align="center" gap="sm">
        <Box
          style={{ position: 'relative', display: 'inline-block', cursor: isExpired ? 'default' : 'pointer' }}
          onClick={() => !isExpired && setFullscreen(true)}
        >
          <img
            src={qrUrl}
            alt="QR Code"
            width={200}
            height={200}
            style={{ opacity: isExpired ? 0.3 : 1, borderRadius: 8 }}
          />
          {isExpired && (
            <Text
              fw={700}
              size="lg"
              c="red"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            >
              Expired
            </Text>
          )}
        </Box>
        <Button
          variant="light"
          size="compact-sm"
          leftSection={<IconCopy size={14} />}
          onClick={handleCopy}
          disabled={isExpired}
        >
          Copy Link
        </Button>
      </Stack>

      {/* Fullscreen QR Overlay */}
      <Modal
        opened={fullscreen}
        onClose={() => setFullscreen(false)}
        fullScreen
        withCloseButton={false}
        styles={{
          content: {
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          body: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            padding: 0,
          },
        }}
      >
        <Box
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
          style={{ textAlign: 'center' }}
        >
          <Button
            variant="subtle"
            color="gray.3"
            size="compact-md"
            onClick={() => setFullscreen(false)}
            style={{ position: 'absolute', top: 16, right: 16 }}
            aria-label="Close"
          >
            <IconX size={24} />
          </Button>

          <img
            src={qrUrlLarge}
            alt="QR Code"
            width={300}
            height={300}
            style={{ borderRadius: 0, marginBottom: 16 }}
          />

          <Text c="white" size="sm" mb="md" style={{ wordBreak: 'break-all', maxWidth: 340, margin: '0 auto' }}>
            {feedbackLink}
          </Text>

          <Button
            variant="white"
            size="sm"
            leftSection={<IconCopy size={16} />}
            onClick={handleCopy}
          >
            Copy Link
          </Button>
        </Box>
      </Modal>
    </>
  );
}
