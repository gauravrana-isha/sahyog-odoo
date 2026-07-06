import { useMemo, useState } from 'react';
import { Box, Group, InputBase, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconClock } from '@tabler/icons-react';
import { Wheel, WheelFrame, PickerActions, PickerSheet } from './WheelPicker';

interface TimePickerProps {
  label?: string;
  value: string; // "HH:MM" in 24h format
  onChange: (value: string) => void;
  size?: string;
  error?: string | null;
  readOnly?: boolean;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => String(i === 0 ? 12 : i));
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const PERIODS = ['AM', 'PM'];

interface TimeParts {
  hour: string;
  minute: string;
  period: string;
}

function to12Hour(time24: string): TimeParts {
  if (!time24 || !time24.includes(':')) return { hour: '12', minute: '00', period: 'AM' };
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const minute = (mStr || '00').padStart(2, '0');
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: String(h), minute, period };
}

function to24Hour({ hour, minute, period }: TimeParts): string {
  let h = parseInt(hour, 10);
  if (period === 'AM' && h === 12) h = 0;
  else if (period === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

export function TimePicker({ label, value, onChange, size = 'md', error, readOnly = false }: TimePickerProps) {
  const [opened, { close, open }] = useDisclosure(false);
  const { hour, minute, period } = to12Hour(value);

  // Draft pattern: wheels edit a local copy; the value only commits on "Set time".
  const [draft, setDraft] = useState<TimeParts>({ hour, minute, period });

  // 5-minute steps; if the current value is off-grid (e.g. a schedule-locked
  // "6:37"), include it so the wheel can still display it.
  const minuteItems = useMemo(
    () => (MINUTES_5.includes(draft.minute) ? MINUTES_5 : [...MINUTES_5, draft.minute].sort((a, b) => +a - +b)),
    [draft.minute],
  );

  const openPicker = () => {
    setDraft(to12Hour(value));
    open();
  };

  const commit = () => {
    onChange(to24Hour(draft));
    close();
  };

  return (
    <>
      <InputBase
        component="button"
        type="button"
        label={label}
        error={error}
        size={size}
        pointer={!readOnly}
        rightSection={<IconClock size={16} color="var(--mantine-color-dimmed)" />}
        onClick={() => { if (!readOnly) openPicker(); }}
        aria-label={label ? undefined : 'Pick time'}
        style={readOnly ? { opacity: 0.7 } : undefined}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{hour}:{minute} {period}</span>
      </InputBase>

      <PickerSheet opened={opened} onClose={close}>
        {/* Header: field label + large live preview */}
        <Box ta="center" mb="sm">
          {label && (
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.08em' }}>
              {label}
            </Text>
          )}
          <Group justify="center" align="baseline" gap={8} mt={2}>
            <Text ff="heading" fw={600} fz={42} lh={1.1} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {draft.hour}:{draft.minute}
            </Text>
            <Text ff="heading" fw={600} fz="xl" c="clay">
              {draft.period}
            </Text>
          </Group>
        </Box>

        <WheelFrame>
          <Wheel items={HOURS_12} value={draft.hour} onChange={(h) => setDraft({ ...draft, hour: h })} ariaLabel="Hour" loop />
          <Wheel items={minuteItems} value={draft.minute} onChange={(m) => setDraft({ ...draft, minute: m })} ariaLabel="Minute" loop />
          <Wheel items={PERIODS} value={draft.period} onChange={(p) => setDraft({ ...draft, period: p })} ariaLabel="AM or PM" />
        </WheelFrame>

        <PickerActions onCancel={close} onCommit={commit} commitLabel="Set time" />
      </PickerSheet>
    </>
  );
}
