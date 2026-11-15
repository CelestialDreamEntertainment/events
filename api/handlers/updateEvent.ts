import { ConflictError, defineHandler } from '@sbwp/runtime';
import app from '../app';
import { eventDetail, findHosted } from '../lib/access';
import { collections, eventInput, idParams, storedFields } from '../lib/model';

/** Replaces an event's details. Only its host can, and not once it's cancelled. */
export const handler = defineHandler(
    app,
    { params: idParams, body: eventInput },
    async ({ params, body, user }, ctx) => {
        const event = await findHosted(ctx, params.id, user);
        if (event.cancelledAt) {
            throw new ConflictError('The event is cancelled');
        }
        const changes = { ...storedFields(body, user), updatedAt: new Date() };
        await collections(ctx).events.updateOne({ _id: event._id }, { $set: changes });
        return eventDetail(ctx, { ...event, ...changes }, user);
    }
);
