import {
    Alert,
    Button,
    Group,
    Loader,
    SegmentedControl,
    Select,
    Stack,
    Switch,
    TagsInput,
    Text,
    Textarea,
    TextInput,
    Title
} from '@mantine/core';
import { ApiError } from '@sbwp/web';
import { useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import type { EventBody, EventDetail } from '../api';
import { useApi } from '../context';
import { useLoad } from '../useLoad';
import { browserTimeZone, isoToZoned, TIME_ZONES, zonedToIso } from '../zones';

type Fields = {
    title: string;
    description: string;
    location: string;
    starts: string;
    ends: string;
    timeZone: string;
    visibility: 'public' | 'private';
    invitees: string[];
    surprise: boolean;
    forName: string;
    forEmails: string[];
    coverTitle: string;
    coverDescription: string;
    coverLocation: string;
    coverStarts: string;
    coverEnds: string;
};

const noSurprise = {
    surprise: false,
    forName: '',
    forEmails: [],
    coverTitle: '',
    coverDescription: '',
    coverLocation: '',
    coverStarts: '',
    coverEnds: ''
};

const blank = (): Fields => ({
    title: '',
    description: '',
    location: '',
    starts: '',
    ends: '',
    timeZone: browserTimeZone(),
    visibility: 'public',
    invitees: [],
    ...noSurprise
});

const fromEvent = (event: EventDetail): Fields => ({
    title: event.title,
    description: event.description,
    location: event.location,
    starts: isoToZoned(event.startsAt, event.timeZone),
    ends: isoToZoned(event.endsAt, event.timeZone),
    timeZone: event.timeZone,
    visibility: event.visibility,
    invitees: event.invitees ?? [],
    ...(event.surprise
        ? {
              surprise: true,
              forName: event.surprise.forName,
              forEmails: event.surprise.for ?? [],
              coverTitle: event.surprise.cover.title,
              coverDescription: event.surprise.cover.description,
              coverLocation: event.surprise.cover.location,
              coverStarts: isoToZoned(event.surprise.cover.startsAt, event.timeZone),
              coverEnds: isoToZoned(event.surprise.cover.endsAt, event.timeZone)
          }
        : noSurprise)
});

const toBody = (fields: Fields): EventBody => ({
    title: fields.title,
    description: fields.description,
    location: fields.location,
    startsAt: zonedToIso(fields.starts, fields.timeZone),
    endsAt: zonedToIso(fields.ends, fields.timeZone),
    timeZone: fields.timeZone,
    visibility: fields.visibility,
    invitees: fields.visibility === 'private' ? fields.invitees : [],
    surprise: fields.surprise
        ? {
              for: fields.forEmails,
              forName: fields.forName,
              cover: {
                  title: fields.coverTitle,
                  description: fields.coverDescription,
                  location: fields.coverLocation,
                  startsAt: zonedToIso(fields.coverStarts, fields.timeZone),
                  endsAt: zonedToIso(fields.coverEnds, fields.timeZone)
              }
          }
        : null
});

const Form = ({ initial, id }: { initial: Fields; id?: string }) => {
    const api = useApi();
    const [, navigate] = useLocation();
    const [fields, setFields] = useState(initial);
    const [error, setError] = useState<string>();
    const [saving, setSaving] = useState(false);
    const update = <K extends keyof Fields>(key: K, value: Fields[K]) =>
        setFields((f) => ({ ...f, [key]: value }));
    // Turning a surprise on starts the cover story at the real time and place.
    const setSurprise = (on: boolean) =>
        setFields((f) => ({
            ...f,
            surprise: on,
            coverStarts: f.coverStarts || f.starts,
            coverEnds: f.coverEnds || f.ends,
            coverLocation: f.coverLocation || f.location
        }));

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError(undefined);
        if (!fields.starts || !fields.ends) {
            setError('Pick a start and an end.');
            return;
        }
        if (fields.surprise && (!fields.coverStarts || !fields.coverEnds)) {
            setError('Pick a start and an end for the cover story.');
            return;
        }
        setSaving(true);
        try {
            const body = toBody(fields);
            const saved = id
                ? await api.put('/events/:id', { params: { id }, body })
                : await api.post('/events', { body });
            navigate(`/events/${saved.id}`);
        } catch (err) {
            const issues = err instanceof ApiError ? err.issues : undefined;
            setError(
                issues?.length
                    ? issues.map((i) => `${i.path}: ${i.message}`).join('. ')
                    : (err as Error).message
            );
            setSaving(false);
        }
    };

    return (
        <form onSubmit={(e) => void submit(e)}>
            <Stack>
                <Title order={1}>{id ? 'Edit event' : 'New event'}</Title>
                <TextInput
                    label="Title"
                    required
                    maxLength={200}
                    value={fields.title}
                    onChange={(e) => update('title', e.currentTarget.value)}
                />
                <Group grow>
                    <TextInput
                        label="Starts"
                        type="datetime-local"
                        required
                        value={fields.starts}
                        onChange={(e) => update('starts', e.currentTarget.value)}
                    />
                    <TextInput
                        label="Ends"
                        type="datetime-local"
                        required
                        value={fields.ends}
                        onChange={(e) => update('ends', e.currentTarget.value)}
                    />
                </Group>
                <Select
                    label="Time zone"
                    searchable
                    data={TIME_ZONES}
                    value={fields.timeZone}
                    // With allowDeselect off, Mantine never passes null here.
                    onChange={(zone) => update('timeZone', zone as string)}
                    allowDeselect={false}
                />
                <TextInput
                    label="Location"
                    maxLength={500}
                    value={fields.location}
                    onChange={(e) => update('location', e.currentTarget.value)}
                />
                <Textarea
                    label="Details"
                    autosize
                    minRows={3}
                    maxLength={5000}
                    value={fields.description}
                    onChange={(e) => update('description', e.currentTarget.value)}
                />
                <Stack gap={4}>
                    <Text size="sm" fw={500}>
                        Who can see it
                    </Text>
                    <SegmentedControl
                        value={fields.visibility}
                        onChange={(value) => update('visibility', value as Fields['visibility'])}
                        data={[
                            { value: 'public', label: 'Everyone' },
                            { value: 'private', label: 'Only invited guests' }
                        ]}
                    />
                </Stack>
                {fields.visibility === 'private' ? (
                    <TagsInput
                        label="Invited guests"
                        description="Their sign-in emails. Press Enter after each one."
                        value={fields.invitees}
                        onChange={(invitees) => update('invitees', invitees)}
                    />
                ) : null}
                <Switch
                    label="Surprise party"
                    description="The people it’s for see a cover story instead of the real details."
                    checked={fields.surprise}
                    onChange={(e) => setSurprise(e.currentTarget.checked)}
                />
                {fields.surprise ? (
                    <Stack>
                        <TextInput
                            label="Who it’s for"
                            description="Everyone in on it sees this name."
                            required
                            maxLength={100}
                            value={fields.forName}
                            onChange={(e) => update('forName', e.currentTarget.value)}
                        />
                        <TagsInput
                            label="Their emails"
                            description="Their sign-in emails. They only ever see the cover story, even on a private event. Press Enter after each one."
                            value={fields.forEmails}
                            onChange={(emails) => update('forEmails', emails)}
                        />
                        <Title order={2} size="h4">
                            The cover story
                        </Title>
                        <TextInput
                            label="Cover title"
                            required
                            maxLength={200}
                            value={fields.coverTitle}
                            onChange={(e) => update('coverTitle', e.currentTarget.value)}
                        />
                        <Group grow>
                            <TextInput
                                label="Cover starts"
                                type="datetime-local"
                                required
                                value={fields.coverStarts}
                                onChange={(e) => update('coverStarts', e.currentTarget.value)}
                            />
                            <TextInput
                                label="Cover ends"
                                type="datetime-local"
                                required
                                value={fields.coverEnds}
                                onChange={(e) => update('coverEnds', e.currentTarget.value)}
                            />
                        </Group>
                        <TextInput
                            label="Cover location"
                            maxLength={500}
                            value={fields.coverLocation}
                            onChange={(e) => update('coverLocation', e.currentTarget.value)}
                        />
                        <Textarea
                            label="Cover details"
                            autosize
                            minRows={2}
                            maxLength={5000}
                            value={fields.coverDescription}
                            onChange={(e) => update('coverDescription', e.currentTarget.value)}
                        />
                    </Stack>
                ) : null}
                {error ? <Alert color="red">{error}</Alert> : null}
                <Group>
                    <Button type="submit" loading={saving}>
                        {id ? 'Save' : 'Create event'}
                    </Button>
                    <Button variant="default" onClick={() => navigate(id ? `/events/${id}` : '/')}>
                        Back
                    </Button>
                </Group>
            </Stack>
        </form>
    );
};

export const NewEventPage = () => <Form initial={blank()} />;

export const EditEventPage = ({ id }: { id: string }) => {
    const api = useApi();
    const { state } = useLoad(() => api.get('/events/:id', { params: { id } }), id);
    if (state.status === 'loading') {
        return <Loader aria-label="Loading" />;
    }
    if (state.status === 'error') {
        return <Alert color="red">{state.error.message}</Alert>;
    }
    return <Form initial={fromEvent(state.data)} id={id} />;
};
