import { ForbiddenError, NotFoundError, type Context } from '@sbwp/runtime';
import { canSee, collections, type EventDoc, type EventsUser } from './model';
import { countRsvps, emptyCounts, eventView, rsvpView, type EventDetail } from './views';

/** Loads an event the user can see. Events they can't see are a 404, so their existence never leaks. */
export const findVisible = async (
    ctx: Context,
    id: string,
    user: EventsUser
): Promise<EventDoc> => {
    const event = await collections(ctx).events.findOne({ _id: id });
    if (!event || !canSee(event, user)) {
        throw new NotFoundError('No such event');
    }
    return event;
};

/** Loads an event the user hosts. Other hosts get a 403 for events they can see. */
export const findHosted = async (ctx: Context, id: string, user: EventsUser): Promise<EventDoc> => {
    const event = await findVisible(ctx, id, user);
    if (event.hostId !== user.id) {
        throw new ForbiddenError('Only the event’s host can change it');
    }
    return event;
};

/** The full view of one event: counts, the viewer's RSVP, and every RSVP for hosts. */
export const eventDetail = async (
    ctx: Context,
    event: EventDoc,
    user: EventsUser
): Promise<EventDetail> => {
    const rsvps = await collections(ctx)
        .rsvps.find({ eventId: event._id })
        .sort({ updatedAt: 1 })
        .toArray();
    const counts = countRsvps(rsvps).get(event._id) ?? emptyCounts();
    const mine = rsvps.find((r) => r.userId === user.id);
    return {
        ...eventView(event, user, counts, mine),
        ...(user.has('events:host') ? { rsvps: rsvps.map(rsvpView) } : {})
    };
};
