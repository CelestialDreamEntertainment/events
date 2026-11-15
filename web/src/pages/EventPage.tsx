import {
    Alert,
    Anchor,
    Badge,
    Button,
    Group,
    Loader,
    Stack,
    Table,
    Text,
    Textarea,
    Title
} from '@mantine/core';
import { ApiError } from '@sbwp/web';
import { useState } from 'react';
import { Link } from 'wouter';
import type { EventDetail, RsvpResponse } from '../api';
import { useApi } from '../context';
import { formatRange, RESPONSE_LABELS } from '../format';
import { useLoad } from '../useLoad';

const RESPONSES = ['going', 'maybe', 'no'] as const satisfies readonly RsvpResponse[];

const Rsvp = ({
    event,
    onChange
}: {
    event: EventDetail;
    onChange: (event: EventDetail) => void;
}) => {
    const api = useApi();
    const [note, setNote] = useState(event.myRsvp?.note ?? '');
    const [error, setError] = useState<string>();
    const send = async (response: RsvpResponse) => {
        setError(undefined);
        try {
            onChange(
                await api.put('/events/:id/rsvp', {
                    params: { id: event.id },
                    body: { response, note }
                })
            );
        } catch (e) {
            setError((e as Error).message);
        }
    };
    return (
        <Stack gap="xs">
            <Title order={2} size="h4">
                Are you coming?
            </Title>
            <Textarea
                label="Note (optional)"
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
                maxLength={500}
            />
            <Group>
                {RESPONSES.map((response) => (
                    <Button
                        key={response}
                        variant={event.myRsvp?.response === response ? 'filled' : 'default'}
                        aria-pressed={event.myRsvp?.response === response}
                        onClick={() => void send(response)}
                    >
                        {RESPONSE_LABELS[response]}
                    </Button>
                ))}
            </Group>
            {error ? <Alert color="red">{error}</Alert> : null}
        </Stack>
    );
};

const Rsvps = ({ rsvps }: { rsvps: NonNullable<EventDetail['rsvps']> }) =>
    rsvps.length === 0 ? (
        <Text c="dimmed">No RSVPs yet.</Text>
    ) : (
        <Table>
            <Table.Thead>
                <Table.Tr>
                    <Table.Th>Guest</Table.Th>
                    <Table.Th>Response</Table.Th>
                    <Table.Th>Note</Table.Th>
                </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
                {rsvps.map((rsvp) => (
                    <Table.Tr key={rsvp.email}>
                        <Table.Td>{rsvp.name ?? rsvp.email}</Table.Td>
                        <Table.Td>{RESPONSE_LABELS[rsvp.response]}</Table.Td>
                        <Table.Td>{rsvp.note}</Table.Td>
                    </Table.Tr>
                ))}
            </Table.Tbody>
        </Table>
    );

/** One event: its details, the viewer's RSVP, and for hosts everyone's RSVPs. */
export const EventPage = ({ id }: { id: string }) => {
    const api = useApi();
    const { state, set } = useLoad(() => api.get('/events/:id', { params: { id } }), id);
    const [error, setError] = useState<string>();
    if (state.status === 'loading') {
        return <Loader aria-label="Loading" />;
    }
    if (state.status === 'error') {
        const missing = state.error instanceof ApiError && state.error.status === 404;
        return (
            <Alert color="red">
                {missing ? 'This event doesn’t exist, or you’re not invited.' : state.error.message}
            </Alert>
        );
    }
    const event = state.data;
    const cancel = async () => {
        try {
            set(await api.post('/events/:id/cancel', { params: { id } }));
        } catch (e) {
            setError((e as Error).message);
        }
    };
    return (
        <Stack>
            <Anchor component={Link} href="/">
                ← All events
            </Anchor>
            <Group justify="space-between" align="flex-start">
                <Title order={1}>{event.title}</Title>
                <Group gap="xs">
                    {event.cancelled ? <Badge color="red">Cancelled</Badge> : null}
                    <Badge variant="light">
                        {event.visibility === 'private' ? 'Private' : 'Public'}
                    </Badge>
                </Group>
            </Group>
            <Text>{formatRange(event.startsAt, event.endsAt, event.timeZone)}</Text>
            {event.location ? <Text>{event.location}</Text> : null}
            {event.description ? (
                <Text style={{ whiteSpace: 'pre-wrap' }}>{event.description}</Text>
            ) : null}
            <Text size="sm" c="dimmed">
                Hosted by {event.host.name ?? event.host.email} · {event.counts.going} going ·{' '}
                {event.counts.maybe} maybe · {event.counts.no} not going
            </Text>
            {event.isHost && !event.cancelled ? (
                <Group>
                    <Button component={Link} href={`/events/${event.id}/edit`} variant="default">
                        Edit
                    </Button>
                    <Button color="red" variant="light" onClick={() => void cancel()}>
                        Cancel event
                    </Button>
                </Group>
            ) : null}
            {error ? <Alert color="red">{error}</Alert> : null}
            {event.cancelled ? (
                <Alert color="red">This event is cancelled.</Alert>
            ) : (
                <Rsvp event={event} onChange={set} />
            )}
            {event.rsvps ? (
                <Stack gap="xs">
                    <Title order={2} size="h4">
                        RSVPs
                    </Title>
                    <Rsvps rsvps={event.rsvps} />
                </Stack>
            ) : null}
            {event.invitees && event.visibility === 'private' ? (
                <Text size="sm" c="dimmed">
                    Invited: {event.invitees.length > 0 ? event.invitees.join(', ') : 'nobody yet'}
                </Text>
            ) : null}
        </Stack>
    );
};
