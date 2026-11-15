import { defineHandler } from '@sbwp/runtime';
import { z } from 'zod';
import app from '../app';
import { collections, visibleTo } from '../lib/model';
import { eventView } from '../lib/views';

/** Every event the user can see: upcoming ones soonest first, or past ones latest first. */
export const handler = defineHandler(
    app,
    { query: z.object({ when: z.enum(['upcoming', 'past']).default('upcoming') }) },
    async ({ query, user }, ctx) => {
        const { events, rsvps } = collections(ctx);
        const now = new Date();
        const upcoming = query.when === 'upcoming';
        const found = await events
            .find(visibleTo(user, upcoming ? { $gte: now } : { $lt: now }))
            .sort({ startsAt: upcoming ? 1 : -1 })
            .limit(200)
            .toArray();
        const ids = found.map((event) => event._id);
        const all = await rsvps.find({ eventId: { $in: ids } }).toArray();
        const views = found.map((event) =>
            eventView(
                event,
                user,
                all.filter((r) => r.eventId === event._id),
                all.find((r) => r.eventId === event._id && r.userId === user.id)
            )
        );
        // A cover story's times can differ from the real ones, so sort by what each viewer sees.
        const direction = upcoming ? 1 : -1;
        return views.sort((a, b) => direction * (a.startsAt.getTime() - b.startsAt.getTime()));
    }
);
