import { Box, Button, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCopy } from '@tabler/icons-react';

interface QRCodeDisplayProps {
  feedbackLink: string;
  qrExpiry: string;
}

export function QRCodeDisplay({ feedbackLink, qrExpiry }: QRCodeDisplayProps) {
  const isExpired = qrExpiry ? new Date() > new Date(qrExpiry) : false;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(feedbackLink)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(feedbackLink);
      notifications.show({ title: 'Copied', message: 'Feedback link copied to clipboard', color: 'green' });
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to copy link', color: 'red' });
    }
  };

  return (
    <Stack align="center" gap="sm">
      <Box style={{ position: 'relative', display: 'inline-block' }}>
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
  );
}
