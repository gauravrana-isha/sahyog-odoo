import { Box, Button, CloseButton, Group, Text, Stack } from '@mantine/core';
import { IconDownload, IconShare } from '@tabler/icons-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export function InstallBanner() {
  const { canShow, isIos, install, dismiss } = usePwaInstall();

  if (!canShow) return null;

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 72, // above the bottom nav
        left: 8,
        right: 8,
        zIndex: 200,
        borderRadius: 12,
        padding: '12px 16px',
        backgroundColor: 'var(--mantine-color-blue-6)',
        color: '#fff',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      }}
    >
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4} style={{ flex: 1 }}>
          <Text fw={600} size="sm" c="white">
            Install Sahyog
          </Text>
          {isIos ? (
            <Text size="xs" c="white" opacity={0.85}>
              Tap <IconShare size={14} style={{ verticalAlign: 'middle' }} /> then "Add to Home Screen"
            </Text>
          ) : (
            <Text size="xs" c="white" opacity={0.85}>
              Add to your home screen for quick access
            </Text>
          )}
        </Stack>
        <Group gap={4} wrap="nowrap">
          {!isIos && (
            <Button
              size="compact-sm"
              variant="white"
              color="blue"
              leftSection={<IconDownload size={14} />}
              onClick={install}
            >
              Install
            </Button>
          )}
          <CloseButton
            size="sm"
            variant="transparent"
            c="white"
            onClick={dismiss}
            aria-label="Dismiss install banner"
          />
        </Group>
      </Group>
    </Box>
  );
}
