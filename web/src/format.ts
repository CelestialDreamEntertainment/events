/** Formats an event's time range in the event's own time zone, e.g. "Sat, Nov 22, 6:00 PM – 9:00 PM CST". */
export const formatRange = (
    startsAt: string,
    endsAt: string,
    timeZone: string,
    locale?: string
): string => {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const day = new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone
    });
    const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone });
    const zone = new Intl.DateTimeFormat(locale, { timeZoneName: 'short', timeZone })
        .formatToParts(start)
        .find((part) => part.type === 'timeZoneName')?.value;
    const sameDay = day.format(start) === day.format(end);
    const range = sameDay
        ? `${day.format(start)}, ${time.format(start)} – ${time.format(end)}`
        : `${day.format(start)}, ${time.format(start)} – ${day.format(end)}, ${time.format(end)}`;
    return zone ? `${range} ${zone}` : range;
};

export const RESPONSE_LABELS = { going: 'Going', maybe: 'Maybe', no: 'Not going' } as const;
