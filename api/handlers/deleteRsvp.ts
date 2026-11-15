import { defineHandler, noContent } from '@sbwp/runtime';
import app from '../app';
import { findVisible } from '../lib/access';
import { collections, idParams } from '../lib/model';

/** Removes the signed-in user's RSVP, if they have one. */
export const handler = defineHandler(app, { params: idParams }, async ({ params, user }, ctx) => {
    const event = await findVisible(ctx, params.id, user);
    await collections(ctx).rsvps.deleteOne({ _id: `${event._id}:${user.id}` });
    return noContent();
});
