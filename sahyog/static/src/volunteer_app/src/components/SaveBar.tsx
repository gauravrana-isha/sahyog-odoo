import { Affix, Box, Button, Group, Transition } from '@mantine/core';

interface SaveBarProps {
  /** Show the bar (typically `editing && isDirty`). */
  mounted: boolean;
  saving?: boolean;
  onSave: () => void;
  onCancel?: () => void;
  label?: string;
}

/** The one floating save bar for all edit flows: slides up from the bottom
 *  when there are unsaved changes, with optional Cancel alongside Save. */
export function SaveBar({ mounted, saving, onSave, onCancel, label = 'Save Changes' }: SaveBarProps) {
  return (
    <Affix position={{ bottom: 0, left: 0, right: 0 }} zIndex={200}>
      <Transition mounted={mounted} transition="slide-up">
        {(styles) => (
          <Box
            style={{
              ...styles,
              backgroundColor: 'var(--mantine-color-body)',
              borderTop: '1px solid var(--mantine-color-default-border)',
              boxShadow: 'var(--mantine-shadow-lg)',
              padding: 12,
              paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            }}
          >
            <Group maw={640} mx="auto" gap="sm" wrap="nowrap">
              {onCancel && (
                <Button variant="default" size="md" flex={1} onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button size="md" flex={2} loading={saving} onClick={onSave}>
                {label}
              </Button>
            </Group>
          </Box>
        )}
      </Transition>
    </Affix>
  );
}
