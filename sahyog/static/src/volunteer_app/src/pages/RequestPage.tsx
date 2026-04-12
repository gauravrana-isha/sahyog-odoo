import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { IconAlertCircle } from '@tabler/icons-react';
import { format } from 'date-fns';
import { apiGet, apiPost } from '../api';
import { useApi } from '../hooks/useApi';
import type { AvailableProgram, ProgramSchedule } from '../types';

type RequestType = 'program' | 'break' | 'silence' | 'unavailability';

export function RequestPage() {
  const navigate = useNavigate();
  const isWide = useMediaQuery('(min-width: 768px)');
  const [requestType, setRequestType] = useState<RequestType>('program');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Program form state
  const { data: programs } = useApi<AvailableProgram[]>('/programs/available');
  const [programId, setProgramId] = useState<string | null>(null);
  const [participationType, setParticipationType] = useState('participant');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  // Break form state
  const [breakType, setBreakType] = useState<string | null>(null);
  const [breakReason, setBreakReason] = useState('');
  const [breakNotes, setBreakNotes] = useState('');
  const [breakStart, setBreakStart] = useState<Date | null>(null);
  const [breakEnd, setBreakEnd] = useState<Date | null>(null);

  // Silence form state
  const [silenceType, setSilenceType] = useState<string | null>(null);
  const [silenceNotes, setSilenceNotes] = useState('');
  const [silenceStart, setSilenceStart] = useState<Date | null>(null);
  const [silenceEnd, setSilenceEnd] = useState<Date | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [silenceStartTime, setSilenceStartTime] = useState('');
  const [silenceEndTime, setSilenceEndTime] = useState('');

  // Program schedule state
  const [schedules, setSchedules] = useState<ProgramSchedule[]>([]);
  const [scheduleId, setScheduleId] = useState<string | null>(null);

  // Unavailability form state
  const [unavailDate, setUnavailDate] = useState<Date | null>(null);
  const [unavailStartTime, setUnavailStartTime] = useState('');
  const [unavailEndTime, setUnavailEndTime] = useState('');
  const [unavailReason, setUnavailReason] = useState('');

  const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');

  // Auto-set recurring fields when silence_type is 9pm_9am
  useEffect(() => {
    if (silenceType === '9pm_9am') {
      setIsRecurring(true);
      setSilenceStartTime('21:00');
      setSilenceEndTime('09:00');
    }
  }, [silenceType]);

  // Fetch schedules when a program is selected
  useEffect(() => {
    if (!programId) {
      setSchedules([]);
      setScheduleId(null);
      return;
    }
    apiGet<ProgramSchedule[]>(`/programs/${programId}/schedules`)
      .then((data) => {
        setSchedules(data || []);
        setScheduleId(null);
      })
      .catch(() => {
        setSchedules([]);
        setScheduleId(null);
      });
  }, [programId]);

  const resetAll = () => {
    setProgramId(null);
    setParticipationType('participant');
    setStartDate(null);
    setEndDate(null);
    setLocation('');
    setNotes('');
    setBreakType(null);
    setBreakReason('');
    setBreakNotes('');
    setBreakStart(null);
    setBreakEnd(null);
    setSilenceType(null);
    setSilenceNotes('');
    setSilenceStart(null);
    setSilenceEnd(null);
    setIsRecurring(false);
    setSilenceStartTime('');
    setSilenceEndTime('');
    setSchedules([]);
    setScheduleId(null);
    setUnavailDate(null);
    setUnavailStartTime('');
    setUnavailEndTime('');
    setUnavailReason('');
    setError(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (requestType === 'program') {
        if (!programId || !startDate || !endDate) {
          setError('Please fill in all required fields');
          setSubmitting(false);
          return;
        }
        await apiPost('/programs/create', {
          program_id: Number(programId),
          participation_type: participationType,
          start_date: fmtDate(startDate),
          end_date: fmtDate(endDate),
          location,
          notes,
          ...(scheduleId ? { schedule_id: Number(scheduleId) } : {}),
        });
        notifications.show({
          title: 'Request Submitted',
          message: 'Your program enrollment has been submitted.',
          color: 'green',
        });
        resetAll();
        navigate('/history?filter=programs');
      } else if (requestType === 'break') {
        if (!breakType || !breakStart || !breakEnd) {
          setError('Please fill in all required fields');
          setSubmitting(false);
          return;
        }
        await apiPost('/breaks/create', {
          break_type: breakType,
          start_date: fmtDate(breakStart),
          end_date: fmtDate(breakEnd),
          reason: breakReason,
          notes: breakNotes,
        });
        notifications.show({
          title: 'Request Submitted',
          message: 'Your break request has been submitted.',
          color: 'green',
        });
        resetAll();
        navigate('/history?filter=breaks');
      } else if (requestType === 'silence') {
        if (!silenceType || !silenceStart || !silenceEnd) {
          setError('Please fill in all required fields');
          setSubmitting(false);
          return;
        }
        await apiPost('/silence/create', {
          silence_type: silenceType,
          start_date: fmtDate(silenceStart),
          end_date: fmtDate(silenceEnd),
          notes: silenceNotes,
          is_recurring: isRecurring,
          start_time: silenceStartTime,
          end_time: silenceEndTime,
        });
        notifications.show({
          title: 'Request Submitted',
          message: 'Your silence request has been submitted.',
          color: 'green',
        });
        resetAll();
        navigate('/history?filter=silence');
      } else {
        if (!unavailDate || !unavailStartTime || !unavailEndTime) {
          setError('Please fill in all required fields');
          setSubmitting(false);
          return;
        }
        await apiPost('/unavailability/create', {
          date: fmtDate(unavailDate),
          start_time: unavailStartTime,
          end_time: unavailEndTime,
          reason: unavailReason,
        });
        notifications.show({
          title: 'Marked Unavailable',
          message: 'Your unavailability has been recorded.',
          color: 'green',
        });
        resetAll();
        navigate('/history?filter=unavailability');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
      notifications.show({ title: 'Error', message: msg, color: 'red' });
    } finally {
      setSubmitting(false);
    }
  };

  const programOptions = (programs || []).map((p) => ({
    value: String(p.id),
    label: p.name,
  }));

  const formContent = (
    <Box>
      {requestType === 'program' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select
            label="Choose Program"
            placeholder="Search programs..."
            searchable
            data={programOptions}
            value={programId}
            onChange={setProgramId}
            size="md"
          />
          <SegmentedControl
            value={participationType}
            onChange={setParticipationType}
            data={[
              { label: 'Participant', value: 'participant' },
              { label: 'Volunteer', value: 'volunteer' },
            ]}
            size="sm"
          />
          {schedules.length > 0 && (
            <Select
              label="Schedule"
              placeholder="Pick a schedule"
              data={schedules.map((s) => ({
                value: String(s.id),
                label: `${s.start_date} → ${s.end_date} at ${s.location}`,
              }))}
              value={scheduleId}
              onChange={(val) => {
                setScheduleId(val);
                const selected = schedules.find((s) => String(s.id) === val);
                if (selected) {
                  setStartDate(new Date(selected.start_date));
                  setEndDate(new Date(selected.end_date));
                  setLocation(selected.location);
                }
              }}
              size="md"
            />
          )}
          <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
            <DateInput
              label="Start Date"
              placeholder="Pick start date"
              value={startDate}
              onChange={setStartDate}
              size="md"
            />
            <DateInput
              label="End Date"
              placeholder="Pick end date"
              value={endDate}
              onChange={setEndDate}
              size="md"
            />
          </SimpleGrid>
          <TextInput
            label="Location"
            placeholder="Optional"
            value={location}
            onChange={(e) => setLocation(e.currentTarget.value)}
            size="md"
          />
          <Textarea
            label="Notes"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            minRows={2}
            autosize
            size="md"
          />
          <Button fullWidth size="md" loading={submitting} onClick={handleSubmit}>
            Submit Request
          </Button>
        </Box>
      )}

      {requestType === 'break' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select
            label="Break Type"
            placeholder="Select type"
            data={[
              { value: 'personal', label: 'Personal' },
              { value: 'health', label: 'Health' },
              { value: 'family_emergency', label: 'Family Emergency' },
            ]}
            value={breakType}
            onChange={setBreakType}
            size="md"
          />
          <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
            <DateInput
              label="Start Date"
              placeholder="Pick start date"
              value={breakStart}
              onChange={setBreakStart}
              size="md"
            />
            <DateInput
              label="End Date"
              placeholder="Pick end date"
              value={breakEnd}
              onChange={setBreakEnd}
              size="md"
            />
          </SimpleGrid>
          <TextInput
            label="Reason"
            placeholder="Optional"
            value={breakReason}
            onChange={(e) => setBreakReason(e.currentTarget.value)}
            size="md"
          />
          <Textarea
            label="Notes"
            placeholder="Optional"
            value={breakNotes}
            onChange={(e) => setBreakNotes(e.currentTarget.value)}
            minRows={2}
            autosize
            size="md"
          />
          <Button fullWidth size="md" loading={submitting} onClick={handleSubmit}>
            Submit Request
          </Button>
        </Box>
      )}

      {requestType === 'silence' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select
            label="Silence Type"
            placeholder="Select type"
            data={[
              { value: 'personal', label: 'Personal' },
              { value: '9pm_9am', label: '9PM–9AM' },
              { value: 'program', label: 'Program' },
            ]}
            value={silenceType}
            onChange={setSilenceType}
            size="md"
          />
          <SimpleGrid cols={isWide ? 2 : 1} spacing="sm">
            <DateInput
              label="Start Date"
              placeholder="Pick start date"
              value={silenceStart}
              onChange={setSilenceStart}
              size="md"
            />
            <DateInput
              label="End Date"
              placeholder="Pick end date"
              value={silenceEnd}
              onChange={setSilenceEnd}
              size="md"
            />
          </SimpleGrid>
          <Checkbox
            label="Recurring"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.currentTarget.checked)}
          />
          {isRecurring && (
            <SimpleGrid cols={2} spacing="sm">
              <TextInput
                label="Start Time"
                type="time"
                value={silenceStartTime}
                onChange={(e) => setSilenceStartTime(e.currentTarget.value)}
                size="md"
              />
              <TextInput
                label="End Time"
                type="time"
                value={silenceEndTime}
                onChange={(e) => setSilenceEndTime(e.currentTarget.value)}
                size="md"
              />
            </SimpleGrid>
          )}
          <Textarea
            label="Notes"
            placeholder="Optional"
            value={silenceNotes}
            onChange={(e) => setSilenceNotes(e.currentTarget.value)}
            minRows={2}
            autosize
            size="md"
          />
          <Button fullWidth size="md" loading={submitting} onClick={handleSubmit}>
            Submit Request
          </Button>
        </Box>
      )}

      {requestType === 'unavailability' && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DateInput
            label="Date"
            placeholder="Pick date"
            value={unavailDate}
            onChange={setUnavailDate}
            size="md"
          />
          <SimpleGrid cols={2} spacing="sm">
            <TextInput
              label="Start Time"
              placeholder="HH:MM"
              value={unavailStartTime}
              onChange={(e) => setUnavailStartTime(e.currentTarget.value)}
              size="md"
            />
            <TextInput
              label="End Time"
              placeholder="HH:MM"
              value={unavailEndTime}
              onChange={(e) => setUnavailEndTime(e.currentTarget.value)}
              size="md"
            />
          </SimpleGrid>
          <TextInput
            label="Reason"
            placeholder="Optional"
            value={unavailReason}
            onChange={(e) => setUnavailReason(e.currentTarget.value)}
            size="md"
          />
          <Button fullWidth size="md" loading={submitting} onClick={handleSubmit}>
            Mark Unavailable
          </Button>
        </Box>
      )}

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          mt="md"
          title="Error"
        >
          {error}
        </Alert>
      )}
    </Box>
  );

  return (
    <Box style={{ maxWidth: isWide ? 600 : undefined, margin: isWide ? '0 auto' : undefined }}>
      <SegmentedControl
        fullWidth
        value={requestType}
        onChange={(v) => {
          setRequestType(v as RequestType);
          setError(null);
        }}
        data={[
          { label: 'Program', value: 'program' },
          { label: 'Break', value: 'break' },
          { label: 'Silence', value: 'silence' },
          { label: 'Unavailability', value: 'unavailability' },
        ]}
        size="sm"
        mb="lg"
      />
      {isWide ? (
        <Card shadow="sm" padding="lg" withBorder>
          {formContent}
        </Card>
      ) : (
        formContent
      )}
    </Box>
  );
}
