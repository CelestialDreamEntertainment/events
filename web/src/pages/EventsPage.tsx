import {
    Alert,
    Badge,
    Button,
    Card,
    Group,
    Loader,
    SegmentedControl,
    Stack,
    Text,
    Title
} from '@mantine/core';
import { useState } from 'react';
import { Link } from 'wouter';
import { useUser, type EventSummary } from '../api';
import { useApi } from '../context';
import { formatRange, RESPONSE_LABELS } from '../format';
import { useLoad } from '../useLoad';

const EventCard = ({ event }: { event: EventSummary }) => (
    <Card withBorder component={Link} href={`/events/${event.id}`} aria-label={event.title}>
        <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
                <Text fw={600} td={event.cancelled ? 'line-through' : undefined}>
                    {event.title}
                </Text>
                <Text size="sm" c="dimmed">
                    {formatRange(event.startsAt, event.endsAt, event.timeZone)}
                </Text>
                {event.location ? <Text size="sm">{event.location}</Text> : null}
            </Stack>
            <Group gap="xs">
                {event.cancelled ? <Badge color="red">Cancelled</Badge> : null}
                {event.visibility === 'private' ? <Badge variant="light">Private</Badge> : null}
                {event.myRsvp ? (
                    <Badge variant="outline">{RESPONSE_LABELS[event.myRsvp.response]}</Badge>
                ) : null}
            </Group>
        </Group>
        <Text size="sm" mt="xs" c="dimmed">
            {event.counts.going} going · {event.counts.maybe} maybe
        </Text>
    </Card>
);

/** The calendar: every event the user can see, upcoming or past. */
export const EventsPage = () => {
    const api = useApi();
    const user = useUser();
    const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
    const { state } = useLoad(() => api.get('/events', { query: { when } }), when);
    return (
        <Stack>
            <Group justify="space-between">
                <Title order={1}>Events</Title>
                {user?.has('events:host') ? (
                    <Button component={Link} href="/new">
                        New event
                    </Button>
                ) : null}
            </Group>
            <SegmentedControl
                value={when}
                onChange={(value) => setWhen(value as 'upcoming' | 'past')}
                data={[
                    { value: 'upcoming', label: 'Upcoming' },
                    { value: 'past', label: 'Past' }
                ]}
            />
            {state.status === 'loading' ? <Loader aria-label="Loading" /> : null}
            {state.status === 'error' ? <Alert color="red">{state.error.message}</Alert> : null}
            {state.status === 'ready' && state.data.length === 0 ? (
                <Text c="dimmed">
                    {when === 'upcoming' ? 'Nothing planned yet.' : 'No past events.'}
                </Text>
            ) : null}
            {state.status === 'ready'
                ? state.data.map((event) => <EventCard key={event.id} event={event} />)
                : null}
        </Stack>
    );
};
