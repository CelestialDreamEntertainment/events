import {
    isSurprised,
    type Cover,
    type EventDoc,
    type EventsUser,
    type RsvpDoc,
    type RsvpResponse,
    type Visibility
} from './model';

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
    /**
     * Set when the event is a surprise party and the viewer is in on it. The people it's for get
     * the cover story in place of the real details, and never this field.
     */
    surprise?: {
        forName: string;
        /** Their emails, for the event's own host only. */
        for?: string[];
        cover: Cover;
    };
    cancelled: boolean;
    counts: Counts;
    myRsvp: { response: RsvpResponse; note: string } | null;
};

export type RsvpView = { name: string | null; email: string; response: RsvpResponse; note: string };

export type EventDetail = EventView & {
    /** Every RSVP, for viewers with `events:host`. Guests only see the counts and their own. */
    rsvps?: RsvpView[];
};

export const countRsvps = (rsvps: readonly RsvpDoc[]): Counts => {
    const counts: Counts = { going: 0, maybe: 0, no: 0 };
    for (const rsvp of rsvps) {
        counts[rsvp.response] += 1;
    }
    return counts;
};

/** Whether an RSVP's guest can still see the event, e.g. not after being uninvited. */
const stillInvited = (event: EventDoc, rsvp: RsvpDoc): boolean => {
    const email = rsvp.email.toLowerCase();
    return (
        event.visibility === 'public' ||
        rsvp.userId === event.hostId ||
        event.invitees.includes(email) ||
        (event.surprise?.for.includes(email) ?? false)
    );
};

/**
 * The RSVPs a viewer may know about. RSVPs from guests who can no longer see the event don't
 * count, but stay stored in case they're invited again. Someone a surprise is for only learns
 * about the others it's a surprise for, since a crowd RSVPing to a quiet dinner would give it away.
 */
export const rsvpsFor = (event: EventDoc, user: EventsUser, rsvps: readonly RsvpDoc[]) => {
    const current = rsvps.filter((rsvp) => stillInvited(event, rsvp));
    return isSurprised(event, user)
        ? current.filter((rsvp) => event.surprise?.for.includes(rsvp.email.toLowerCase()))
        : current;
};

/** How one event looks to one user, given that event's RSVPs. */
export const eventView = (
    event: EventDoc,
    user: EventsUser,
    rsvps: readonly RsvpDoc[],
    mine: RsvpDoc | undefined
): EventView => {
    const isHost = event.hostId === user.id;
    const shared = {
        id: event._id,
        host: { name: event.hostName, email: event.hostEmail },
        cancelled: event.cancelledAt !== null,
        counts: countRsvps(rsvpsFor(event, user, rsvps)),
        myRsvp: mine ? { response: mine.response, note: mine.note } : null
    };
    if (event.surprise && isSurprised(event, user)) {
        // Built field by field, so nothing about the real event can slip through.
        const { cover } = event.surprise;
        return {
            ...shared,
            // The cover passes for an ordinary public event, in its own time zone.
            visibility: 'public',
            timeZone: cover.timeZone,
            title: cover.title,
            description: cover.description,
            location: cover.location,
            startsAt: cover.startsAt,
            endsAt: cover.endsAt,
            isHost: false
        };
    }
    return {
        ...shared,
        title: event.title,
        description: event.description,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timeZone: event.timeZone,
        visibility: event.visibility,
        isHost,
        ...(isHost ? { invitees: event.invitees } : {}),
        ...(event.surprise
            ? {
                  surprise: {
                      forName: event.surprise.forName,
                      ...(isHost ? { for: event.surprise.for } : {}),
                      cover: event.surprise.cover
                  }
              }
            : {})
    };
};

export const rsvpView = (rsvp: RsvpDoc): RsvpView => ({
    name: rsvp.name,
    email: rsvp.email,
    response: rsvp.response,
    note: rsvp.note
});
