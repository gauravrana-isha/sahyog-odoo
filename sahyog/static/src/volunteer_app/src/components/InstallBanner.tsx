import { Box, Button, CloseButton, Group, Text } from '@mantine/core';
import { IconDownload, IconShare } from '@tabler/icons-react';
import { usePwaInstall } from '../hooks/usePwaInstall';

export function InstallBanner() {
  const { canShow, isIos, install, dismiss } = usePwaInstall();

  if (!canShow) return null;

  return (
    <Box
      style={{
        width: '100%',
        padding: '8px 16px',
        backgroundColor: 'var(--mantine-color-blue-6)',
        color: '#fff',
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap">
        <Group gap={8} align="center" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <IconDownload size={16} color="#fff" style={{ flexShrink: 0 }} />
          {isIos ? (
            <Text size="sm" c="white" truncate>
              Tap <IconShare size={13} style={{ verticalAlign: 'middle' }} /> then "Add to Home Screen"
            </Text>
          ) : (
            <Text size="sm" c="white" truncate>
              Install Sahyog for quick access
            </Text>
          )}
        </Group>
        <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
          {!isIos && (
            <Button
              size="compact-sm"
              variant="white"
              color="blue"
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
