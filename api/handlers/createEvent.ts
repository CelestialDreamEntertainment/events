import { randomUUID } from 'node:crypto';
import { created, defineHandler } from '@sbwp/runtime';
import app from '../app';
import { collections, eventInput, type EventDoc } from '../lib/model';
import { emptyCounts, eventView } from '../lib/views';

export const handler = defineHandler(app, { body: eventInput }, async ({ body, user }, ctx) => {
    const now = new Date();
    const event: EventDoc = {
        _id: randomUUID(),
        ...body,
        invitees: body.visibility === 'private' ? [...new Set(body.invitees)] : [],
        hostId: user.id,
        hostEmail: user.email,
        hostName: user.name ?? null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now
    };
    await collections(ctx).events.insertOne(event);
    ctx.log.info('Event created', { eventId: event._id, visibility: event.visibility });
    return created(eventView(event, user, emptyCounts(), undefined));
});
