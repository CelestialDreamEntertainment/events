import { ConflictError, defineHandler } from '@sbwp/runtime';
import { z } from 'zod';
import app from '../app';
import { eventDetail, findVisible } from '../lib/access';
import { collections, idParams, RESPONSES } from '../lib/model';

/** Sets the signed-in user's RSVP: going, maybe or not going, with an optional note. */
export const handler = defineHandler(
    app,
    {
        params: idParams,
        body: z.object({
            response: z.enum(RESPONSES),
            note: z.string().trim().max(500).default('')
        })
    },
    async ({ params, body, user }, ctx) => {
        const event = await findVisible(ctx, params.id, user);
        if (event.cancelledAt) {
            throw new ConflictError('The event is cancelled');
        }
        await collections(ctx).rsvps.replaceOne(
            { _id: `${event._id}:${user.id}` },
            {
                eventId: event._id,
                userId: user.id,
                email: user.email,
                name: user.name ?? null,
                response: body.response,
                note: body.note,
                updatedAt: new Date()
            },
            { upsert: true }
        );
        return eventDetail(ctx, event, user);
    }
);
