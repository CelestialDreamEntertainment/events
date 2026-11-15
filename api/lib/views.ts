import type { EventDoc, EventsUser, RsvpDoc, RsvpResponse, Visibility } from './model';

export type Counts = Record<RsvpResponse, number>;

export type EventView = {
    id: string;
    title: string;
    description: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
    timeZone: string;
    visibility: Visibility;
    host: { name: string | null; email: string };
    /** Whether the viewer is this event's host, who can edit and cancel it. */
    isHost: boolean;
    /** Only the event's own host sees who's invited. */
    invitees?: string[];
    cancelled: boolean;
    counts: Counts;
    myRsvp: { response: RsvpResponse; note: string } | null;
};

export type RsvpView = { name: string | null; email: string; response: RsvpResponse; note: string };

export type EventDetail = EventView & {
    /** Every RSVP, for viewers with `events:host`. Guests only see the counts and their own. */
    rsvps?: RsvpView[];
};

export const emptyCounts = (): Counts => ({ going: 0, maybe: 0, no: 0 });

export const countRsvps = (rsvps: readonly RsvpDoc[]): Map<string, Counts> => {
    const counts = new Map<string, Counts>();
    for (const rsvp of rsvps) {
        const forEvent = counts.get(rsvp.eventId) ?? emptyCounts();
        forEvent[rsvp.response] += 1;
        counts.set(rsvp.eventId, forEvent);
    }
    return counts;
};

export const eventView = (
    event: EventDoc,
    user: EventsUser,
    counts: Counts,
    mine: RsvpDoc | undefined
): EventView => {
    const isHost = event.hostId === user.id;
    return {
        id: event._id,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timeZone: event.timeZone,
        visibility: event.visibility,
        host: { name: event.hostName, email: event.hostEmail },
        isHost,
        ...(isHost ? { invitees: event.invitees } : {}),
        cancelled: event.cancelledAt !== null,
        counts,
        myRsvp: mine ? { response: mine.response, note: mine.note } : null
    };
};

export const rsvpView = (rsvp: RsvpDoc): RsvpView => ({
    name: rsvp.name,
    email: rsvp.email,
    response: rsvp.response,
    note: rsvp.note
});
