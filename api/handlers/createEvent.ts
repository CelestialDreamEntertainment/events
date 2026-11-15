import { randomUUID } from 'node:crypto';
import { created, defineHandler } from '@sbwp/runtime';
import app from '../app';
import { collections, eventInput, storedFields, type EventDoc } from '../lib/model';
import { eventView } from '../lib/views';

export const handler = defineHandler(app, { body: eventInput }, async ({ body, user }, ctx) => {
    const now = new Date();
    const event: EventDoc = {
        _id: randomUUID(),
        ...storedFields(body, user),
        hostId: user.id,
        hostEmail: user.email,
        hostName: user.name ?? null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now
    };
    await collections(ctx).events.insertOne(event);
    ctx.log.info('Event created', {
        eventId: event._id,
        visibility: event.visibility,
        surprise: event.surprise !== null
    });
    return created(eventView(event, user, [], undefined));
});
