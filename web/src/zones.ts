/** The offset of `timeZone` from UTC at `instant`, in milliseconds. */
const offsetAt = (instant: number, timeZone: string): number => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })
            .formatToParts(instant)
            .map((part) => [part.type, Number(part.value)])
    ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
    const asUtc = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second
    );
    return asUtc - Math.floor(instant / 1000) * 1000;
};

/** Turns a wall-clock time in a time zone (`2026-11-22T18:00`) into an ISO instant. */
export const zonedToIso = (local: string, timeZone: string): string => {
    const [date = '', time = '00:00'] = local.split('T');
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    const [h, min] = time.split(':').map(Number) as [number, number];
    const wall = Date.UTC(y, m - 1, d, h, min);
    let instant = wall - offsetAt(wall, timeZone);
    // A second pass settles times near a daylight saving change.
    instant = wall - offsetAt(instant, timeZone);
    return new Date(instant).toISOString();
};

/** The wall-clock time (`2026-11-22T18:00`) an ISO instant shows in a time zone. */
export const isoToZoned = (iso: string, timeZone: string): string => {
    const instant = new Date(iso).getTime();
    return new Date(instant + offsetAt(instant, timeZone)).toISOString().slice(0, 16);
};

export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Every zone to pick from. `Intl.supportedValuesOf` leaves out `UTC` and aliases such as
 * `Asia/Calcutta`, so the browser's own zone is added in case it's one of those.
 */
export const TIME_ZONES: readonly string[] = [
    ...new Set([...Intl.supportedValuesOf('timeZone'), 'UTC', browserTimeZone()])
].sort();
