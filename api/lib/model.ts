import { BadRequestError, type Context, type User } from '@sbwp/runtime';
import { z } from 'zod';

export const VISIBILITIES = ['public', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const RESPONSES = ['going', 'maybe', 'no'] as const;
export type RsvpResponse = (typeof RESPONSES)[number];

/** The made-up version of a surprise party that the people it's for see instead of the real one. */
export type Cover = {
    title: string;
    description: string;
    location: string;
    startsAt: Date;
    endsAt: Date;
};

/**
 * Makes an event a surprise party. The people in `for` (lowercased emails) see only the cover
 * story, even on a private event they aren't invited to, and never the real details.
 */
export type Surprise = {
    /** Their sign-in emails, which only the host sees. */
    for: string[];
    /** Who it's for, as everyone else in on it sees it, e.g. "Bob". */
    forName: string;
    cover: Cover;
};

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
    surprise: Surprise | null;
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

/** Whether the event is a surprise for this user, who must only ever see its cover story. */
export const isSurprised = (event: EventDoc, user: EventsUser): boolean =>
    event.surprise?.for.includes(user.email.toLowerCase()) ?? false;

/** Whether a user can see an event at all. Everything else is hidden behind a 404. */
export const canSee = (event: EventDoc, user: EventsUser): boolean =>
    event.visibility === 'public' ||
    event.hostId === user.id ||
    event.invitees.includes(user.email.toLowerCase()) ||
    isSurprised(event, user);

/**
 * The Mongo filter matching every event a user can see whose shown end time matches `ends`: the
 * cover story's for surprises they're the guest of honor at, the real one otherwise.
 */
export const visibleTo = (user: EventsUser, ends: Record<string, Date>) => {
    const email = user.email.toLowerCase();
    return {
        $or: [
            { 'surprise.for': email, 'surprise.cover.endsAt': ends },
            {
                'surprise.for': { $ne: email },
                endsAt: ends,
                $or: [{ visibility: 'public' as const }, { hostId: user.id }, { invitees: email }]
            }
        ]
    };
};

const isTimeZone = (zone: string): boolean => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        return true;
    } catch {
        return false;
    }
};

const dateTime = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

// Loose on purpose: test users like alice@test have no TLD, and Cognito checks real addresses.
const email = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[^\s@]+@[^\s@]+$/, 'Enter an email address');

const endsAfterStart = <S extends z.ZodType<{ startsAt: Date; endsAt: Date }>>(schema: S) =>
    schema.refine((value) => value.endsAt > value.startsAt, {
        message: 'The event must end after it starts',
        path: ['endsAt']
    });

const details = {
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000).default(''),
    location: z.string().trim().max(500).default(''),
    startsAt: dateTime,
    endsAt: dateTime
};

const surpriseInput = z.object({
    for: z.array(email).min(1).max(20),
    forName: z.string().trim().min(1).max(100),
    cover: endsAfterStart(z.object(details))
});

export const eventInput = endsAfterStart(
    z.object({
        ...details,
        timeZone: z.string().refine(isTimeZone, 'Unknown time zone'),
        visibility: z.enum(VISIBILITIES),
        invitees: z.array(email).max(200).default([]),
        surprise: surpriseInput.nullable().default(null)
    })
);

export type EventInput = z.output<typeof eventInput>;

export const idParams = z.object({ id: z.string().min(1).max(100) });

/**
 * Turns validated input into the fields stored on an event: invitees only on private events, no
 * duplicate emails, and never a surprise for the host, who'd see straight through it.
 */
export const storedFields = (input: EventInput, host: EventsUser) => {
    const { surprise, invitees, ...rest } = input;
    if (surprise?.for.includes(host.email.toLowerCase())) {
        throw new BadRequestError('You can’t host your own surprise party', [
            { path: 'surprise.for', message: 'Remove your own email' }
        ]);
    }
    return {
        ...rest,
        invitees: input.visibility === 'private' ? [...new Set(invitees)] : [],
        surprise: surprise ? { ...surprise, for: [...new Set(surprise.for)] } : null
    };
};
