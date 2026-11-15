import { defineHandler } from '@sbwp/runtime';
import app from '../app';
import { eventDetail, findHosted } from '../lib/access';
import { collections, idParams } from '../lib/model';

/** Cancels an event. It stays visible, marked cancelled, so guests learn it's off. Cancelling twice is fine. */
export const handler = defineHandler(app, { params: idParams }, async ({ params, user }, ctx) => {
    const event = await findHosted(ctx, params.id, user);
    const cancelledAt = event.cancelledAt ?? new Date();
    await collections(ctx).events.updateOne(
        { _id: event._id },
        { $set: { cancelledAt, updatedAt: cancelledAt } }
    );
    return eventDetail(ctx, { ...event, cancelledAt }, user);
});
