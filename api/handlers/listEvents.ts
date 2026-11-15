import { defineHandler } from '@sbwp/runtime';
import { z } from 'zod';
import app from '../app';
import { collections, visibleTo } from '../lib/model';
import { countRsvps, emptyCounts, eventView } from '../lib/views';

/** Every event the user can see: upcoming ones soonest first, or past ones latest first. */
export const handler = defineHandler(
    app,
    { query: z.object({ when: z.enum(['upcoming', 'past']).default('upcoming') }) },
    async ({ query, user }, ctx) => {
        const { events, rsvps } = collections(ctx);
        const now = new Date();
        const upcoming = query.when === 'upcoming';
        const found = await events
            .find({ ...visibleTo(user), endsAt: upcoming ? { $gte: now } : { $lt: now } })
            .sort({ startsAt: upcoming ? 1 : -1 })
            .limit(200)
            .toArray();
        const ids = found.map((event) => event._id);
        const all = await rsvps.find({ eventId: { $in: ids } }).toArray();
        const counts = countRsvps(all);
        return found.map((event) =>
            eventView(
                event,
                user,
                counts.get(event._id) ?? emptyCounts(),
                all.find((r) => r.eventId === event._id && r.userId === user.id)
            )
        );
    }
);
