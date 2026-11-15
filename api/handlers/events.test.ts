import { beforeEach, describe, expect, it } from 'vitest';
import { alice, bob, caller, carol, dave, testDb, type TestUser } from '../test/harness';
import { handler as cancelEvent } from './cancelEvent';
import { handler as createEvent } from './createEvent';
import { handler as deleteRsvp } from './deleteRsvp';
import { handler as getEvent } from './getEvent';
import { handler as health } from './health';
import { handler as listEvents } from './listEvents';
import { handler as setRsvp } from './setRsvp';
import { handler as updateEvent } from './updateEvent';

const db = testDb();
const call = caller(db);

const inDays = (days: number, hours = 0) =>
    new Date(Date.now() + days * 86_400_000 + hours * 3_600_000).toISOString();

const picnic = {
    title: 'Picnic',
    description: 'Bring snacks',
    location: 'The park',
    startsAt: inDays(7),
    endsAt: inDays(7, 3),
    timeZone: 'America/Chicago',
    visibility: 'public'
};

const create = async (overrides: Record<string, unknown> = {}, user = alice) => {
    const res = await call(
        createEvent,
        { method: 'POST', path: '/events' },
        { user, body: { ...picnic, ...overrides } }
    );
    expect(res.status).toBe(201);
    return res.body as { id: string };
};

const get = (id: string, user: typeof alice | typeof bob | typeof carol | typeof dave) =>
    call(getEvent, { method: 'GET', path: '/events/:id' }, { user, params: { id } });

const list = (user: typeof alice | typeof bob | typeof carol | typeof dave, when?: string) =>
    call(
        listEvents,
        { method: 'GET', path: '/events' },
        { user, ...(when ? { query: { when } } : {}) }
    );

const rsvp = (
    id: string,
    user: typeof alice | typeof bob | typeof carol | typeof dave,
    body: unknown
) => call(setRsvp, { method: 'PUT', path: '/events/:id/rsvp' }, { user, params: { id }, body });

beforeEach(async () => {
    await db.collection('events').deleteMany({});
    await db.collection('rsvps').deleteMany({});
});

describe('health', () => {
    it('is public', async () => {
        expect(await call(health, { method: 'GET', path: '/health' })).toEqual({
            status: 200,
            body: { ok: true }
        });
    });
});

describe('creating events', () => {
    it('lets a host create a public event', async () => {
        const res = await call(
            createEvent,
            { method: 'POST', path: '/events' },
            { user: alice, body: picnic }
        );
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            title: 'Picnic',
            description: 'Bring snacks',
            visibility: 'public',
            host: { name: 'Alice', email: 'alice@test' },
            isHost: true,
            invitees: [],
            cancelled: false,
            counts: { going: 0, maybe: 0, no: 0 },
            myRsvp: null
        });
        expect(res.body.startsAt).toBe(picnic.startsAt);
    });

    it('fills in optional fields and stores hosts without a name', async () => {
        const host = { ...carol, scope: 'events:guest events:host' };
        const res = await call(
            createEvent,
            { method: 'POST', path: '/events' },
            {
                user: host,
                body: {
                    title: ' Games ',
                    startsAt: picnic.startsAt,
                    endsAt: picnic.endsAt,
                    timeZone: 'UTC',
                    visibility: 'public'
                }
            }
        );
        expect(res.body).toMatchObject({
            title: 'Games',
            description: '',
            location: '',
            host: { name: null }
        });
    });

    it('keeps a private event’s invitees, lowercased and unique', async () => {
        const event = await create({ visibility: 'private', invitees: ['Bob@Test', 'bob@test'] });
        expect((await get(event.id, alice)).body.invitees).toEqual(['bob@test']);
    });

    it('drops invitees from public events', async () => {
        const event = await create({ invitees: ['bob@test'] });
        expect((await get(event.id, alice)).body.invitees).toEqual([]);
    });

    it('needs events:host', async () => {
        const res = await call(
            createEvent,
            { method: 'POST', path: '/events' },
            { user: bob, body: picnic }
        );
        expect(res.status).toBe(403);
    });

    it.each([
        ['an empty title', { title: '  ' }, 'title'],
        ['an end before the start', { endsAt: inDays(6) }, 'endsAt'],
        ['an unknown time zone', { timeZone: 'Mars/Olympus' }, 'timeZone'],
        ['a bad visibility', { visibility: 'secret' }, 'visibility'],
        ['a bad invitee', { visibility: 'private', invitees: ['nope'] }, 'invitees.0'],
        ['a date without an offset', { startsAt: '2026-12-01T10:00:00' }, 'startsAt']
    ])('rejects %s', async (_, overrides, path) => {
        const res = await call(
            createEvent,
            { method: 'POST', path: '/events' },
            { user: alice, body: { ...picnic, ...overrides } }
        );
        expect(res.status).toBe(400);
        expect(res.body.error.issues.map((i: { path: string }) => i.path)).toContain(path);
    });
});

describe('who sees what', () => {
    it('shows public events to every guest', async () => {
        const event = await create();
        expect((await get(event.id, bob)).body).toMatchObject({ title: 'Picnic', isHost: false });
        expect((await list(carol)).body.map((e: { id: string }) => e.id)).toEqual([event.id]);
    });

    it('shows private events only to the host and invitees', async () => {
        const event = await create({ visibility: 'private', invitees: ['bob@test'] });
        expect((await get(event.id, alice)).status).toBe(200);
        expect((await get(event.id, { ...bob, email: 'BOB@test' })).status).toBe(200);
        expect((await get(event.id, carol)).status).toBe(404);
        expect((await get(event.id, dave)).status).toBe(404);
        expect((await list(carol)).body).toEqual([]);
        expect((await list(bob)).body).toHaveLength(1);
    });

    it('only shows the invite list to the event’s own host', async () => {
        const event = await create({ visibility: 'private', invitees: ['bob@test', 'dave@test'] });
        expect((await get(event.id, alice)).body.invitees).toEqual(['bob@test', 'dave@test']);
        expect((await get(event.id, bob)).body).not.toHaveProperty('invitees');
        expect((await get(event.id, dave)).body).not.toHaveProperty('invitees');
    });

    it('returns 404 for an unknown event', async () => {
        expect((await get('nope', alice)).status).toBe(404);
    });

    it('lists upcoming events soonest first, and past events latest first', async () => {
        const later = await create({ title: 'Later', startsAt: inDays(10), endsAt: inDays(10, 1) });
        const soon = await create({ title: 'Soon', startsAt: inDays(1), endsAt: inDays(1, 1) });
        const ongoing = await create({
            title: 'Ongoing',
            startsAt: inDays(0, -1),
            endsAt: inDays(0, 1)
        });
        const old = await create({ title: 'Old', startsAt: inDays(-10), endsAt: inDays(-10, 1) });
        const older = await create({
            title: 'Older',
            startsAt: inDays(-20),
            endsAt: inDays(-20, 1)
        });
        const ids = (res: { body: { id: string }[] }) => res.body.map((e) => e.id);
        expect(ids(await list(bob))).toEqual([ongoing.id, soon.id, later.id]);
        expect(ids(await list(bob, 'upcoming'))).toEqual([ongoing.id, soon.id, later.id]);
        expect(ids(await list(bob, 'past'))).toEqual([old.id, older.id]);
        expect((await list(bob, 'someday')).status).toBe(400);
    });
});

describe('RSVPs', () => {
    it('lets a guest RSVP, change it and see the counts', async () => {
        const event = await create();
        const first = await rsvp(event.id, bob, { response: 'maybe' });
        expect(first.body).toMatchObject({
            myRsvp: { response: 'maybe', note: '' },
            counts: { going: 0, maybe: 1, no: 0 }
        });
        const second = await rsvp(event.id, bob, { response: 'going', note: ' Bringing chips ' });
        expect(second.body).toMatchObject({
            myRsvp: { response: 'going', note: 'Bringing chips' },
            counts: { going: 1, maybe: 0, no: 0 }
        });
        await rsvp(event.id, carol, { response: 'no' });
        const listed = (await list(bob)).body[0];
        expect(listed).toMatchObject({
            counts: { going: 1, maybe: 0, no: 1 },
            myRsvp: { response: 'going' }
        });
    });

    it('shows every RSVP to hosts, and only counts to guests', async () => {
        const event = await create();
        await rsvp(event.id, bob, { response: 'going', note: 'Yay' });
        await rsvp(event.id, carol, { response: 'no' });
        expect((await get(event.id, dave)).body.rsvps).toEqual([
            { name: 'Bob', email: 'bob@test', response: 'going', note: 'Yay' },
            { name: null, email: 'carol@test', response: 'no', note: '' }
        ]);
        const guestView = (await get(event.id, bob)).body;
        expect(guestView).not.toHaveProperty('rsvps');
        expect(guestView.counts).toEqual({ going: 1, maybe: 0, no: 1 });
    });

    it('rejects bad responses', async () => {
        const event = await create();
        expect((await rsvp(event.id, bob, { response: 'yes' })).status).toBe(400);
    });

    it('hides private events from people who are not invited', async () => {
        const event = await create({ visibility: 'private', invitees: ['bob@test'] });
        expect((await rsvp(event.id, carol, { response: 'going' })).status).toBe(404);
        expect((await rsvp(event.id, bob, { response: 'going' })).status).toBe(200);
    });

    it('removes an RSVP', async () => {
        const event = await create();
        await rsvp(event.id, bob, { response: 'going' });
        const route = { method: 'DELETE', path: '/events/:id/rsvp' } as const;
        expect(
            (await call(deleteRsvp, route, { user: bob, params: { id: event.id } })).status
        ).toBe(204);
        expect((await get(event.id, bob)).body).toMatchObject({
            myRsvp: null,
            counts: { going: 0 }
        });
        expect(
            (await call(deleteRsvp, route, { user: bob, params: { id: event.id } })).status
        ).toBe(204);
        expect((await call(deleteRsvp, route, { user: bob, params: { id: 'nope' } })).status).toBe(
            404
        );
    });
});

describe('editing and cancelling', () => {
    const update = (id: string, user: typeof alice | typeof dave, body: unknown) =>
        call(updateEvent, { method: 'PUT', path: '/events/:id' }, { user, params: { id }, body });
    const cancel = (id: string, user: typeof alice | typeof dave | typeof bob) =>
        call(cancelEvent, { method: 'POST', path: '/events/:id/cancel' }, { user, params: { id } });

    it('lets the host edit an event, including making it private', async () => {
        const event = await create();
        const res = await update(event.id, alice, {
            ...picnic,
            title: 'Big picnic',
            visibility: 'private',
            invitees: ['Carol@test']
        });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            title: 'Big picnic',
            visibility: 'private',
            invitees: ['carol@test']
        });
        expect((await get(event.id, bob)).status).toBe(404);
        expect((await get(event.id, carol)).status).toBe(200);
    });

    it('clears invitees when an event becomes public', async () => {
        const event = await create({ visibility: 'private', invitees: ['bob@test'] });
        const res = await update(event.id, alice, { ...picnic, invitees: ['bob@test'] });
        expect(res.body.invitees).toEqual([]);
    });

    it('stops other hosts from editing or cancelling', async () => {
        const event = await create();
        expect((await update(event.id, dave, picnic)).status).toBe(403);
        expect((await cancel(event.id, dave)).status).toBe(403);
    });

    it('needs events:host to edit or cancel', async () => {
        const event = await create();
        expect((await cancel(event.id, bob)).status).toBe(403);
    });

    it('cancels an event, keeps it visible, and blocks RSVPs and edits', async () => {
        const event = await create();
        const res = await cancel(event.id, alice);
        expect(res.body.cancelled).toBe(true);
        expect((await get(event.id, bob)).body.cancelled).toBe(true);
        expect((await rsvp(event.id, bob, { response: 'going' })).status).toBe(409);
        expect((await update(event.id, alice, picnic)).status).toBe(409);
        expect((await cancel(event.id, alice)).body.cancelled).toBe(true);
    });
});

describe('surprise parties', () => {
    const cover = {
        title: 'Quiet dinner',
        description: 'Just us two',
        location: 'Alice’s place',
        startsAt: inDays(7, 1),
        endsAt: inDays(7, 2)
    };
    const party = {
        ...picnic,
        title: 'Bob’s surprise party',
        description: 'Hide behind the couch',
        location: 'The big house',
        surprise: { for: ['BOB@test', 'bob@test'], forName: 'Bob', cover }
    };
    const update = (id: string, body: unknown) =>
        call(
            updateEvent,
            { method: 'PUT', path: '/events/:id' },
            { user: alice, params: { id }, body }
        );

    it('shows the people it’s for only the cover story', async () => {
        const event = await create(party);
        const res = await get(event.id, bob);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            title: 'Quiet dinner',
            description: 'Just us two',
            location: 'Alice’s place',
            startsAt: cover.startsAt,
            endsAt: cover.endsAt,
            isHost: false
        });
        const text = JSON.stringify(res.body);
        for (const secret of ['surprise', 'couch', 'big house', 'Bob’s', picnic.startsAt]) {
            expect(text).not.toContain(secret);
        }
        expect(Object.keys(res.body).sort()).toEqual(
            [
                'id',
                'title',
                'description',
                'location',
                'startsAt',
                'endsAt',
                'timeZone',
                'visibility',
                'host',
                'isHost',
                'cancelled',
                'counts',
                'myRsvp'
            ].sort()
        );
    });

    it('lets everyone else in on it, and only the host sees who it’s for by email', async () => {
        const event = await create(party);
        const guest = (await get(event.id, carol)).body;
        expect(guest.title).toBe('Bob’s surprise party');
        expect(guest.surprise).toEqual({ forName: 'Bob', cover });
        const host = (await get(event.id, alice)).body;
        expect(host.surprise).toEqual({ forName: 'Bob', for: ['bob@test'], cover });
    });

    it('shows the cover on a private event even to people it’s for who aren’t invited', async () => {
        const event = await create({ ...party, visibility: 'private', invitees: ['carol@test'] });
        expect((await get(event.id, bob)).body.title).toBe('Quiet dinner');
        expect((await get(event.id, carol)).body.title).toBe('Bob’s surprise party');
        expect((await get(event.id, dave)).status).toBe(404);
        expect((await list(dave)).body).toEqual([]);
        expect((await list(bob)).body.map((e: { title: string }) => e.title)).toEqual([
            'Quiet dinner'
        ]);
    });

    it('lists the cover by its own times', async () => {
        // The real party already happened, but the cover dinner is still to come, and sorts
        // before a picnic that's sooner than the real party but later than the cover.
        await create({
            ...party,
            startsAt: inDays(-3),
            endsAt: inDays(-3, 3),
            surprise: {
                ...party.surprise,
                cover: { ...cover, startsAt: inDays(1), endsAt: inDays(1, 1) }
            }
        });
        await create({ ...picnic, startsAt: inDays(2), endsAt: inDays(2, 1) });
        const titles = async (user: TestUser, when: string) =>
            (await list(user, when)).body.map((e: { title: string }) => e.title);
        expect(await titles(bob, 'upcoming')).toEqual(['Quiet dinner', 'Picnic']);
        expect(await titles(bob, 'past')).toEqual([]);
        expect(await titles(carol, 'upcoming')).toEqual(['Picnic']);
        expect(await titles(carol, 'past')).toEqual(['Bob’s surprise party']);
    });

    it('sorts past covers latest first', async () => {
        await create({
            ...party,
            surprise: {
                ...party.surprise,
                cover: { ...cover, startsAt: inDays(-5), endsAt: inDays(-5, 1) }
            }
        });
        await create({
            ...picnic,
            title: 'Old picnic',
            startsAt: inDays(-2),
            endsAt: inDays(-2, 1)
        });
        expect((await list(bob, 'past')).body.map((e: { title: string }) => e.title)).toEqual([
            'Old picnic',
            'Quiet dinner'
        ]);
    });

    it('only counts the RSVPs of the people it’s for, for them', async () => {
        const event = await create({
            ...party,
            surprise: { ...party.surprise, for: ['bob@test', 'dave@test'] }
        });
        await rsvp(event.id, carol, { response: 'going' });
        await rsvp(event.id, alice, { response: 'maybe' });
        const mine = await rsvp(event.id, bob, { response: 'going', note: 'Can’t wait' });
        expect(mine.body).toMatchObject({
            title: 'Quiet dinner',
            counts: { going: 1, maybe: 0, no: 0 },
            myRsvp: { response: 'going', note: 'Can’t wait' }
        });
        // Dave holds events:host, but still only sees who else it's a surprise for.
        const daves = (await get(event.id, dave)).body;
        expect(daves.counts).toEqual({ going: 1, maybe: 0, no: 0 });
        expect(daves.rsvps.map((r: { email: string }) => r.email)).toEqual(['bob@test']);
        expect((await list(dave)).body[0].counts).toEqual({ going: 1, maybe: 0, no: 0 });
        const hosts = (await get(event.id, alice)).body;
        expect(hosts.counts).toEqual({ going: 2, maybe: 1, no: 0 });
        expect(hosts.rsvps).toHaveLength(3);
    });

    it('won’t make the host the guest of honor', async () => {
        const res = await call(
            createEvent,
            { method: 'POST', path: '/events' },
            {
                user: alice,
                body: { ...party, surprise: { ...party.surprise, for: ['Alice@test'] } }
            }
        );
        expect(res.status).toBe(400);
        expect(res.body.error.issues).toEqual([
            { path: 'surprise.for', message: 'Remove your own email' }
        ]);
    });

    it('checks the cover story', async () => {
        const bad = async (surprise: unknown) =>
            (
                await call(
                    createEvent,
                    { method: 'POST', path: '/events' },
                    { user: alice, body: { ...party, surprise } }
                )
            ).status;
        expect(await bad({ ...party.surprise, for: [] })).toBe(400);
        expect(await bad({ ...party.surprise, forName: ' ' })).toBe(400);
        expect(await bad({ ...party.surprise, cover: { ...cover, endsAt: cover.startsAt } })).toBe(
            400
        );
        expect(await bad({ ...party.surprise, cover: { ...cover, title: '' } })).toBe(400);
    });

    it('lets the host call the surprise off, after which everyone sees the real event', async () => {
        const event = await create(party);
        const res = await update(event.id, { ...party, surprise: null });
        expect(res.status).toBe(200);
        expect(res.body.surprise).toBeUndefined();
        expect((await get(event.id, bob)).body.title).toBe('Bob’s surprise party');
    });

    it('lets the host turn an event into a surprise', async () => {
        const event = await create();
        await update(event.id, party);
        expect((await get(event.id, bob)).body.title).toBe('Quiet dinner');
    });
});

describe('uninvited guests', () => {
    const update = (id: string, body: unknown) =>
        call(
            updateEvent,
            { method: 'PUT', path: '/events/:id' },
            { user: alice, params: { id }, body }
        );

    it('stops counting the RSVPs of guests who can no longer see the event', async () => {
        const event = await create();
        await rsvp(event.id, bob, { response: 'going' });
        await rsvp(event.id, carol, { response: 'maybe' });
        await rsvp(event.id, alice, { response: 'going' });
        const res = await update(event.id, {
            ...picnic,
            visibility: 'private',
            invitees: ['carol@test']
        });
        expect(res.body.counts).toEqual({ going: 1, maybe: 1, no: 0 });
        expect(res.body.rsvps.map((r: { email: string }) => r.email)).toEqual([
            'carol@test',
            'alice@test'
        ]);
        expect((await list(carol)).body[0].counts).toEqual({ going: 1, maybe: 1, no: 0 });

        // Invited again, their RSVP counts again.
        const back = await update(event.id, {
            ...picnic,
            visibility: 'private',
            invitees: ['carol@test', 'bob@test']
        });
        expect(back.body.counts).toEqual({ going: 2, maybe: 1, no: 0 });
    });
});
