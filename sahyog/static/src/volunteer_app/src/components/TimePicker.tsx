import { useState, useEffect } from 'react';
import { Group, Select, Text, Box } from '@mantine/core';

interface TimePickerProps {
  label?: string;
  value: string; // "HH:MM" in 24h format
  onChange: (value: string) => void;
  size?: string;
  error?: string | null;
  readOnly?: boolean;
}

const HOURS_12 = Array.from({ length: 12 }, (_, i) => {
  const h = i === 0 ? 12 : i;
  return { value: String(h), label: String(h) };
});

const MINUTES = Array.from({ length: 60 }, (_, i) => ({
  value: String(i).padStart(2, '0'),
  label: String(i).padStart(2, '0'),
}));

const PERIODS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

function to12Hour(time24: string): { hour: string; minute: string; period: string } {
  if (!time24 || !time24.includes(':')) return { hour: '12', minute: '00', period: 'AM' };
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const minute = mStr || '00';
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: String(h), minute, period };
}

function to24Hour(hour: string, minute: string, period: string): string {
  let h = parseInt(hour, 10);
  if (period === 'AM' && h === 12) h = 0;
  else if (period === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

export function TimePicker({ label, value, onChange, size = 'md', error, readOnly = false }: TimePickerProps) {
  const parsed = to12Hour(value);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState(parsed.period);

  // Sync from external value changes
  useEffect(() => {
    const p = to12Hour(value);
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
  }, [value]);

  const handleChange = (h: string, m: string, p: string) => {
    const time24 = to24Hour(h, m, p);
    onChange(time24);
  };

  return (
    <Box>
      {label && <Text size="sm" fw={500} mb={4}>{label}</Text>}
      <Group gap={6} wrap="nowrap">
        <Select
          data={HOURS_12}
          value={hour}
          onChange={(v) => { if (v) { setHour(v); handleChange(v, minute, period); } }}
          size={size}
          style={{ flex: 1 }}
          placeholder="Hr"
          readOnly={readOnly}
          searchable
          maxDropdownHeight={200}
          comboboxProps={{ withinPortal: true }}
        />
        <Text size="lg" fw={600} c="dimmed" style={{ lineHeight: '36px' }}>:</Text>
        <Select
          data={MINUTES}
          value={minute}
          onChange={(v) => { if (v) { setMinute(v); handleChange(hour, v, period); } }}
          size={size}
          style={{ flex: 1 }}
          placeholder="Min"
          readOnly={readOnly}
          searchable
          maxDropdownHeight={200}
          comboboxProps={{ withinPortal: true }}
        />
        <Select
          data={PERIODS}
          value={period}
          onChange={(v) => { if (v) { setPeriod(v); handleChange(hour, minute, v); } }}
          size={size}
          style={{ width: 80 }}
          readOnly={readOnly}
          comboboxProps={{ withinPortal: true }}
        />
      </Group>
      {error && <Text size="xs" c="red" mt={4}>{error}</Text>}
    </Box>
  );
}
