import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Checkbox,
  SegmentedControl,
  Select,
  TextInput,
  Textarea,
  Button,
  Alert,
  Card,
  SimpleGrid,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { IconAlertCircle } from '@tabler/icons-react';
import { format, isBefore, startOfDay } from 'date-fns';
import { apiGet, apiPost } from '../api';
import { useApi } from '../hooks/useApi';
import type { AvailableProgram, ProgramSchedule } from '../types';

type RequestType = 'program' | 'break' | 'silence' | 'unavailability';

function validateDateRange(start: Date | null, end: Date | null): string | null {
  if (!start || !end) return null;
  if (isBefore(startOfDay(end), startOfDay(start))) return 'End date must be on or after start date';
  return null;
}

function validateTime(value: string): string | null {
  if (!value) return null;
  if (!/^\d{2}:\d{2}$/.test(value)) return 'Use HH:MM format';
  const [h, m] = value.split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return 'Invalid time';
  return null;
}

function validateTimeRange(start: string, end: string): string | null {
  if (!start || !end) return null;
  if (validateTime(start) || validateTime(end)) return null;
  if (start >= end) return 'End time must be after start time';
  return null;
}

export function RequestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [requestType, setRequestType] = useState<RequestType>('program');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Program form
  const { data: programs } = useApi<AvailableProgram[]>('/programs/available');
  const [programId, setProgramId] = useState<string | null>(null);
  const [participationType, setParticipationType] = useState('participant');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [progStartTime, setProgStartTime] = useState('');
  const [progEndTime, setProgEndTime] = useState('');
  const [progIsRecurring, setProgIsRecurring] = useState(false);

  // Break form
  const [breakType, setBreakType] = useState<string | null>(null);
  const [breakReason, setBreakReason] = useState('');
  const [breakNotes, setBreakNotes] = useState('');
  const [breakStart, setBreakStart] = useState<Date | null>(null);
  const [breakEnd, setBreakEnd] = useState<Date | null>(null);

  // Silence form
  const [silenceType, setSilenceType] = useState<string | null>(null);
  const [silenceProgramId, setSilenceProgramId] = useState<string | null>(null);
  const [silenceNotes, setSilenceNotes] = useState('');
  const [silenceStart, setSilenceStart] = useState<Date | null>(null);
  const [silenceEnd, setSilenceEnd] = useState<Date | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [silenceStartTime, setSilenceStartTime] = useState('');
  const [silenceEndTime, setSilenceEndTime] = useState('');

  // Unavailability form
  const [unavailDate, setUnavailDate] = useState<Date | null>(null);
  const [unavailStartTime, setUnavailStartTime] = useState('');
  const [unavailEndTime, setUnavailEndTime] = useState('');
  const [unavailReason, setUnavailReason] = useState('');

  const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');

  // Pre-fill from URL params (coming from Programs page "Enroll" button)
  useEffect(() => {
    const pid = searchParams.get('program_id');
    const sid = searchParams.get('schedule_id');
    if (pid) {
      setRequestType('program');
      setProgramId(pid);
      if (sid) setScheduleId(sid);
    }
  }, [searchParams]);

  // Auto-set recurring fields when silence_type changes — clear dependent fields
  useEffect(() => {
    setSilenceProgramId(null);
    setSilenceStart(null);
    setSilenceEnd(null);
    setSilenceNotes('');
    if (silenceType === '9pm_9am') {
      setIsRecurring(true);
      setSilenceStartTime('21:00');
      setSilenceEndTime('09:00');
    } else {
      setIsRecurring(false);
      setSilenceStartTime('');
      setSilenceEndTime('');
    }
  }, [silenceType]);

  // Fetch schedules when a program is selected — clear dependent fields
  useEffect(() => {
    // Clear dependent fields when program changes
    setScheduleId(null);
    setStartDate(null);
    setEndDate(null);
    setLocation('');
    setProgStartTime('');
    setProgEndTime('');
    setProgIsRecurring(false);
    if (!programId) { setSchedules([]); return; }
    apiGet<ProgramSchedule[]>(`/programs/${programId}/schedules`)
      .then((data) => {
        setSchedules(data || []);
        // If schedule_id came from URL, pre-fill dates
        const sid = searchParams.get('schedule_id');
        if (sid && data) {
          const selected = data.find((s) => String(s.id) === sid);
          if (selected) {
            setScheduleId(sid);
            setStartDate(new Date(selected.start_date));
            setEndDate(new Date(selected.end_date));
            setLocation(selected.location);
            setProgStartTime(selected.start_time || '');
            setProgEndTime(selected.end_time || '');
            setProgIsRecurring(selected.is_recurring || false);
          }
        }
      })
      .catch(() => { setSchedules([]); });
  }, [programId, searchParams]);

  const resetAll = () => {
    setProgramId(null); setParticipationType('participant');
    setStartDate(null); setEndDate(null); setLocation(''); setNotes('');
    setBreakType(null); setBreakReason(''); setBreakNotes('');
    setBreakStart(null); setBreakEnd(null);
    setSilenceType(null); setSilenceProgramId(null); setSilenceNotes('');
    setSilenceStart(null); setSilenceEnd(null);
    setIsRecurring(false); setSilenceStartTime(''); setSilenceEndTime('');
    setSchedules([]); setScheduleId(null);
    setProgStartTime(''); setProgEndTime(''); setProgIsRecurring(false);
    setUnavailDate(null); setUnavailStartTime(''); setUnavailEndTime('');
    setUnavailReason(''); setError(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (requestType === 'program') {
        if (!programId) { setError('Please select a program'); setSubmitting(false); return; }
        if (!startDate || !endDate) { setError('Please fill in start and end dates'); setSubmitting(false); return; }
        const dateErr = validateDateRange(startDate, endDate);
        if (dateErr) { setError(dateErr); setSubmitting(false); return; }
        const result = await apiPost<{ id: number; warning?: string }>('/programs/create', {
          program_id: Number(programId), participation_type: participationType,
          start_date: fmtDate(startDate), end_date: fmtDate(endDate),
          location, notes, ...(scheduleId ? { schedule_id: Number(scheduleId) } : {}),
        });
        notifications.show({ title: 'Request Submitted', message: 'Your program enrollment has been submitted.', color: 'green' });
        if (result.warning) {
          notifications.show({ title: 'Overlap Warning', message: result.warning, color: 'orange', autoClose: 8000 });
        }
        resetAll(); navigate('/history?filter=programs');
      } else if (requestType === 'break') {
        if (!breakType) { setError('Please select a break type'); setSubmitting(false); return; }
        if (!breakStart || !breakEnd) { setError('Please fill in start and end dates'); setSubmitting(false); return; }
        const dateErr = validateDateRange(breakStart, breakEnd);
        if (dateErr) { setError(dateErr); setSubmitting(false); return; }
        const result = await apiPost<{ id: number; warning?: string }>('/breaks/create', {
          break_type: breakType, start_date: fmtDate(breakStart), end_date: fmtDate(breakEnd),
          reason: breakReason, notes: breakNotes,
        });
        notifications.show({ title: 'Request Submitted', message: 'Your break request has been submitted.', color: 'green' });
        if (result.warning) {
          notifications.show({ title: 'Overlap Warning', message: result.warning, color: 'orange', autoClose: 8000 });
        }
        resetAll(); navigate('/history?filter=breaks');
      } else if (requestType === 'silence') {
        if (!silenceType) { setError('Please select a silence type'); setSubmitting(false); return; }
        if (silenceType === 'program' && !silenceProgramId) { setError('Please select a program for program silence'); setSubmitting(false); return; }
        if (!silenceStart || !silenceEnd) { setError('Please fill in start and end dates'); setSubmitting(false); return; }
        const dateErr = validateDateRange(silenceStart, silenceEnd);
        if (dateErr) { setError(dateErr); setSubmitting(false); return; }
        if (isRecurring) {
          if (!silenceStartTime || !silenceEndTime) { setError('Please fill in start and end times for recurring silence'); setSubmitting(false); return; }
          const stErr = validateTime(silenceStartTime);
          if (stErr) { setError('Start time: ' + stErr); setSubmitting(false); return; }
          const etErr = validateTime(silenceEndTime);
          if (etErr) { setError('End time: ' + etErr); setSubmitting(false); return; }
        }
        const result = await apiPost<{ id: number; warning?: string }>('/silence/create', {
          silence_type: silenceType, start_date: fmtDate(silenceStart), end_date: fmtDate(silenceEnd),
          notes: silenceNotes, is_recurring: isRecurring,
          start_time: silenceStartTime, end_time: silenceEndTime,
          ...(silenceProgramId ? { program_id: Number(silenceProgramId) } : {}),
        });
        notifications.show({ title: 'Request Submitted', message: 'Your silence request has been submitted.', color: 'green' });
        if (result.warning) {
          notifications.show({ title: 'Overlap Warning', message: result.warning, color: 'orange', autoClose: 8000 });
        }
        resetAll(); navigate('/history?filter=silence');
      } else {
        if (!unavailDate) { setError('Please select a date'); setSubmitting(false); return; }
        if (!unavailStartTime || !unavailEndTime) { setError('Please fill in start and end times'); setSubmitting(false); return; }
        const stErr = validateTime(unavailStartTime);
        if (stErr) { setError('Start time: ' + stErr); setSubmitting(false); return; }
        const etErr = validateTime(unavailEndTime);
        if (etErr) { setError('End time: ' + etErr); setSubmitting(false); return; }
        const trErr = validateTimeRange(unavailStartTime, unavailEndTime);
        if (trErr) { setError(trErr); setSubmitting(false); return; }
        await apiPost('/unavailability/create', {
          date: fmtDate(unavailDate), start_time: unavailStartTime, end_time: unavailEndTime, reason: unavailReason,
        });
        notifications.show({ title: 'Marked Unavailable', message: 'Your unavailability has been recorded.', color: 'green' });
        resetAll(); navigate('/history?filter=unavailability');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    } finally { setSubmitting(false); }
  };

  const programOptions = (programs || []).map((p) => ({ value: String(p.id), label: p.name }));

  const programDateErr = validateDateRange(startDate, endDate);
  const breakDateErr = validateDateRange(breakStart, breakEnd);
  const silenceDateErr = validateDateRange(silenceStart, silenceEnd);
  const unavailStartTimeErr = validateTime(unavailStartTime);
  const unavailEndTimeErr = validateTime(unavailEndTime);
  const unavailTimeRangeErr = !unavailStartTimeErr && !unavailEndTimeErr ? validateTimeRange(unavailStartTime, unavailEndTime) : null;
  const silenceStartTimeErr = isRecurring ? validateTime(silenceStartTime) : null;
  const silenceEndTimeErr = isRecurring ? validateTime(silenceEndTime) : null;
  const is9to9 = silenceType === '9pm_9am';

  const formContent = (
    <Box>
      {requestType === 'program' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select label="Choose Program" placeholder="Search programs..." searchable data={programOptions} value={programId} onChange={setProgramId} size="md" />
          <SegmentedControl value={participationType} onChange={setParticipationType} data={[{ label: 'Participant', value: 'participant' }, { label: 'Volunteer', value: 'volunteer' }]} size="sm" />
          {schedules.length > 0 && (
            <Select label="Schedule" placeholder="Pick a schedule"
              data={schedules.map((s) => {
                const timeStr = s.start_time && s.end_time ? ` (${s.start_time}–${s.end_time})` : '';
                const recurStr = s.is_recurring ? ' [Recurring]' : '';
                return { value: String(s.id), label: `${s.start_date} → ${s.end_date}${timeStr}${recurStr} at ${s.location}` };
              })}
              value={scheduleId}
              onChange={(val) => {
                setScheduleId(val);
                const selected = schedules.find((s) => String(s.id) === val);
                if (selected) {
                  setStartDate(new Date(selected.start_date));
                  setEndDate(new Date(selected.end_date));
                  setLocation(selected.location);
                  setProgStartTime(selected.start_time || '');
                  setProgEndTime(selected.end_time || '');
                  setProgIsRecurring(selected.is_recurring || false);
                }
              }}
              size="md" />
          )}
          {/* Recurring: start date, end date, then start time, end time */}
          {progIsRecurring ? (
            <>
              <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
                <DatePickerInput label="Start Date" placeholder="Pick start date" value={startDate} onChange={setStartDate} size="md" error={programDateErr && startDate && endDate ? programDateErr : undefined} />
                <DatePickerInput label="End Date" placeholder="Pick end date" value={endDate} onChange={setEndDate} size="md" minDate={startDate || undefined} />
              </SimpleGrid>
              <SimpleGrid cols={2} spacing="sm">
                <TextInput label="Start Time" type="time" value={progStartTime} onChange={(e) => setProgStartTime(e.currentTarget.value)} size="md" readOnly={!!scheduleId} />
                <TextInput label="End Time" type="time" value={progEndTime} onChange={(e) => setProgEndTime(e.currentTarget.value)} size="md" readOnly={!!scheduleId} />
              </SimpleGrid>
            </>
          ) : (
            <>
              {/* Non-recurring: start date, start time, then end date, end time */}
              <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
                <DatePickerInput label="Start Date" placeholder="Pick start date" value={startDate} onChange={setStartDate} size="md" error={programDateErr && startDate && endDate ? programDateErr : undefined} />
                {(progStartTime || !scheduleId) && (
                  <TextInput label="Start Time" type="time" value={progStartTime} onChange={(e) => setProgStartTime(e.currentTarget.value)} size="md" readOnly={!!scheduleId} />
                )}
              </SimpleGrid>
              <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
                <DatePickerInput label="End Date" placeholder="Pick end date" value={endDate} onChange={setEndDate} size="md" minDate={startDate || undefined} />
                {(progEndTime || !scheduleId) && (
                  <TextInput label="End Time" type="time" value={progEndTime} onChange={(e) => setProgEndTime(e.currentTarget.value)} size="md" readOnly={!!scheduleId} />
                )}
              </SimpleGrid>
            </>
          )}
          <TextInput label="Location" placeholder="Optional" value={location} onChange={(e) => setLocation(e.currentTarget.value)} size="md" readOnly={!!scheduleId} />
          <Textarea label="Notes" placeholder="Optional" value={notes} onChange={(e) => setNotes(e.currentTarget.value)} minRows={2} autosize size="md" />
          <Button fullWidth size="md" loading={submitting} onClick={handleSubmit}>Submit Request</Button>
        </Box>
      )}

      {requestType === 'break' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select label="Break Type" placeholder="Select type" data={[{ value: 'personal', label: 'Personal' }, { value: 'health', label: 'Health' }, { value: 'family_emergency', label: 'Family Emergency' }]} value={breakType} onChange={setBreakType} size="md" />
          <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
            <DatePickerInput label="Start Date" placeholder="Pick start date" value={breakStart} onChange={setBreakStart} size="md" error={breakDateErr && breakStart && breakEnd ? breakDateErr : undefined} />
            <DatePickerInput label="End Date" placeholder="Pick end date" value={breakEnd} onChange={setBreakEnd} size="md" minDate={breakStart || undefined} />
          </SimpleGrid>
          <TextInput label="Reason" placeholder="Optional" value={breakReason} onChange={(e) => setBreakReason(e.currentTarget.value)} size="md" />
          <Textarea label="Notes" placeholder="Optional" value={breakNotes} onChange={(e) => setBreakNotes(e.currentTarget.value)} minRows={2} autosize size="md" />
          <Button fullWidth size="md" loading={submitting} onClick={handleSubmit}>Submit Request</Button>
        </Box>
      )}

      {requestType === 'silence' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select label="Silence Type" placeholder="Select type" data={[{ value: 'personal', label: 'Personal' }, { value: '9pm_9am', label: '9PM–9AM' }, { value: 'program', label: 'Program' }]} value={silenceType} onChange={setSilenceType} size="md" />

          {/* Program dropdown — only when silence type is "program" */}
          {silenceType === 'program' && (
            <Select label="Program" placeholder="Select program..." searchable data={programOptions} value={silenceProgramId} onChange={setSilenceProgramId} size="md" />
          )}

          <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
            <DatePickerInput label="Start Date" placeholder="Pick start date" value={silenceStart} onChange={setSilenceStart} size="md" error={silenceDateErr && silenceStart && silenceEnd ? silenceDateErr : undefined} />
            <DatePickerInput label="End Date" placeholder="Pick end date" value={silenceEnd} onChange={setSilenceEnd} size="md" minDate={silenceStart || undefined} />
          </SimpleGrid>

          {/* Recurring checkbox — auto-checked and disabled for 9pm-9am */}
          <Checkbox label="Recurring" checked={isRecurring} disabled={is9to9} onChange={(e) => setIsRecurring(e.currentTarget.checked)} />

          {/* Time fields — shown when recurring, read-only for 9pm-9am */}
          {isRecurring && (
            <SimpleGrid cols={2} spacing="sm">
              <TextInput label="Start Time" type="time" value={silenceStartTime} onChange={(e) => setSilenceStartTime(e.currentTarget.value)} size="md" error={silenceStartTimeErr} readOnly={is9to9} />
              <TextInput label="End Time" type="time" value={silenceEndTime} onChange={(e) => setSilenceEndTime(e.currentTarget.value)} size="md" error={silenceEndTimeErr} readOnly={is9to9} />
            </SimpleGrid>
          )}

          <Textarea label="Notes" placeholder="Optional" value={silenceNotes} onChange={(e) => setSilenceNotes(e.currentTarget.value)} minRows={2} autosize size="md" />
          <Button fullWidth size="md" loading={submitting} onClick={handleSubmit}>Submit Request</Button>
        </Box>
      )}

      {requestType === 'unavailability' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DatePickerInput label="Date" placeholder="Pick date" value={unavailDate} onChange={setUnavailDate} size="md" />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput label="Start Time" type="time" value={unavailStartTime} onChange={(e) => setUnavailStartTime(e.currentTarget.value)} size="md" error={unavailStartTimeErr} />
            <TextInput label="End Time" type="time" value={unavailEndTime} onChange={(e) => setUnavailEndTime(e.currentTarget.value)} size="md" error={unavailEndTimeErr || unavailTimeRangeErr} />
          </SimpleGrid>
          <TextInput label="Reason" placeholder="Optional" value={unavailReason} onChange={(e) => setUnavailReason(e.currentTarget.value)} size="md" />
          <Button fullWidth size="md" loading={submitting} onClick={handleSubmit}>Mark Unavailable</Button>
        </Box>
      )}

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mt="md" title="Error">{error}</Alert>
      )}
    </Box>
  );

  return (
    <Box style={{ maxWidth: isWide ? 600 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <SegmentedControl fullWidth value={requestType}
        onChange={(v) => { setRequestType(v as RequestType); setError(null); }}
        data={[
          { label: 'Program', value: 'program' },
          { label: 'Break', value: 'break' },
          { label: 'Silence', value: 'silence' },
          { label: 'Unavailability', value: 'unavailability' },
        ]}
        size="sm" mb="lg" />
      {isWide ? <Card shadow="sm" padding="lg" withBorder>{formContent}</Card> : formContent}
    </Box>
  );
}
