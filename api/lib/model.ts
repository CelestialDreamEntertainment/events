import type { Context, User } from '@sbwp/runtime';
import { z } from 'zod';

export const VISIBILITIES = ['public', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const RESPONSES = ['going', 'maybe', 'no'] as const;
export type RsvpResponse = (typeof RESPONSES)[number];

/**
 * An event as stored. Public events are on everyone's calendar; private ones only show up for
 * their host and invitees (matched by lowercased email).
 */
export type EventDoc = {
    _id: string;
    title: string;
    description: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
    /** The IANA time zone the event happens in, e.g. `America/Chicago`. */
    timeZone: string;
    visibility: Visibility;
    invitees: string[];
    hostId: string;
    hostEmail: string;
    hostName: string | null;
    cancelledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
};

/** One guest's RSVP. Its ID is `<eventId>:<userId>`, so each guest has at most one per event. */
export type RsvpDoc = {
    _id: string;
    eventId: string;
    userId: string;
    email: string;
    name: string | null;
    response: RsvpResponse;
    note: string;
    updatedAt: Date;
};

export type EventsUser = User<'events:guest' | 'events:host'>;

export const collections = (ctx: Context) => ({
    events: ctx.db.collection<EventDoc>('events'),
    rsvps: ctx.db.collection<RsvpDoc>('rsvps')
});

/** Whether a user can see an event at all. Everything else is hidden behind a 404. */
export const canSee = (event: EventDoc, user: EventsUser): boolean =>
    event.visibility === 'public' ||
    event.hostId === user.id ||
    event.invitees.includes(user.email.toLowerCase());

/** The Mongo filter matching every event a user can see. */
export const visibleTo = (user: EventsUser) => ({
    $or: [
        { visibility: 'public' as const },
        { hostId: user.id },
        { invitees: user.email.toLowerCase() }
    ]
});

const isTimeZone = (zone: string): boolean => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch {
        return false;
    }
};

const dateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

export const eventInput = z
    .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().max(5000).default(''),
        location: z.string().trim().max(500).default(''),
        startsAt: dateTime,
        endsAt: dateTime,
        timeZone: z.string().refine(isTimeZone, 'Unknown time zone'),
        visibility: z.enum(VISIBILITIES),
        invitees: z
            // Loose on purpose: test users like alice@test have no TLD, and Cognito checks real addresses.
            .array(
                z
                    .string()
                    .trim()
                    .toLowerCase()
                    .regex(/^[^\s@]+@[^\s@]+$/, 'Enter an email address')
            )
            .max(200)
            .default([])
    })
    .refine((event) => event.endsAt > event.startsAt, {
        message: 'The event must end after it starts',
        path: ['endsAt']
    });

export type EventInput = z.output<typeof eventInput>;

export const idParams = z.object({ id: z.string().min(1).max(100) });
