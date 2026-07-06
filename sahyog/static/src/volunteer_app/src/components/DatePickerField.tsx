import { useState } from 'react';
import type { MantineSize } from '@mantine/core';
import { Box, InputBase, Text } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import { format } from 'date-fns';
import { Wheel, WheelFrame, PickerActions, PickerSheet, MOBILE_QUERY } from './WheelPicker';

interface DatePickerFieldProps {
  label?: string;
  placeholder?: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  size?: MantineSize;
  error?: string | null;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DateParts {
  year: number;
  month: number; // 0-based
  day: number;
}

function toParts(d: Date): DateParts {
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function clampToRange(d: Date, minDate?: Date, maxDate?: Date): Date {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (minDate) {
    const min = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
    if (day < min) return min;
  }
  if (maxDate) {
    const max = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
    if (day > max) return max;
  }
  return day;
}

/**
 * Drop-in replacement for Mantine's DatePickerInput: on desktop it renders the
 * calendar popover unchanged; on mobile it opens the shared wheel-picker
 * bottom sheet (Month | Day | Year) with a draft/commit flow.
 */
export function DatePickerField({
  label,
  placeholder = 'Pick date',
  value,
  onChange,
  size = 'md',
  error,
  minDate,
  maxDate,
  required,
}: DatePickerFieldProps) {
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [opened, { close, open }] = useDisclosure(false);
  const [draft, setDraft] = useState<DateParts>(() => toParts(clampToRange(value ?? new Date(), minDate, maxDate)));

  if (!isMobile) {
    return (
      <DatePickerInput
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        size={size}
        error={error}
        minDate={minDate}
        maxDate={maxDate}
        required={required}
      />
    );
  }

  const openPicker = () => {
    setDraft(toParts(clampToRange(value ?? new Date(), minDate, maxDate)));
    open();
  };

  const commit = () => {
    onChange(clampToRange(new Date(draft.year, draft.month, draft.day), minDate, maxDate));
    close();
  };

  // Day count follows the drafted month/year (Feb 29 etc.); month/year setters
  // clamp the day so the draft can never point at e.g. Feb 31.
  const dayCount = daysInMonth(draft.year, draft.month);
  const dayItems = Array.from({ length: dayCount }, (_, i) => String(i + 1));

  const setMonth = (m: number) => setDraft({ ...draft, month: m, day: Math.min(draft.day, daysInMonth(draft.year, m)) });
  const setYear = (y: number) => setDraft({ ...draft, year: y, day: Math.min(draft.day, daysInMonth(y, draft.month)) });

  const thisYear = new Date().getFullYear();
  const yearFrom = Math.min(minDate?.getFullYear() ?? thisYear - 1, value?.getFullYear() ?? thisYear);
  const yearTo = Math.max(maxDate?.getFullYear() ?? thisYear + 2, value?.getFullYear() ?? thisYear);
  const yearItems = Array.from({ length: yearTo - yearFrom + 1 }, (_, i) => String(yearFrom + i));

  const draftDate = new Date(draft.year, draft.month, draft.day);

  return (
    <>
      <InputBase
        component="button"
        type="button"
        label={label}
        error={error}
        size={size}
        required={required}
        pointer
        rightSection={<IconCalendar size={16} color="var(--mantine-color-dimmed)" />}
        onClick={openPicker}
        aria-label={label ? undefined : 'Pick date'}
      >
        {value ? (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{format(value, 'MMM d, yyyy')}</span>
        ) : (
          <span style={{ color: 'var(--mantine-color-placeholder)' }}>{placeholder}</span>
        )}
      </InputBase>

      <PickerSheet opened={opened} onClose={close}>
        {/* Header: field label + large live preview */}
        <Box ta="center" mb="sm">
          {label && (
            <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.08em' }}>
              {label}
            </Text>
          )}
          <Text ff="heading" fw={600} fz="xl" c="clay" mt={2}>
            {format(draftDate, 'EEEE')}
          </Text>
          <Text ff="heading" fw={600} fz={34} lh={1.15} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {format(draftDate, 'MMM d, yyyy')}
          </Text>
        </Box>

        <WheelFrame>
          <Wheel items={MONTHS} value={MONTHS[draft.month]} onChange={(m) => setMonth(MONTHS.indexOf(m))} ariaLabel="Month" loop />
          <Wheel items={dayItems} value={String(draft.day)} onChange={(d) => setDraft({ ...draft, day: parseInt(d, 10) })} ariaLabel="Day" loop />
          <Wheel items={yearItems} value={String(draft.year)} onChange={(y) => setYear(parseInt(y, 10))} ariaLabel="Year" />
        </WheelFrame>

        <PickerActions onCancel={close} onCommit={commit} commitLabel="Set date" />
      </PickerSheet>
    </>
  );
}
