import { describe, expect, it } from 'vitest';
import { browserTimeZone, isoToZoned, TIME_ZONES, zonedToIso } from './zones';

describe('zones', () => {
    it('turns a wall-clock time in a zone into an instant and back', () => {
        expect(zonedToIso('2026-11-21T18:00', 'America/Chicago')).toBe('2026-11-22T00:00:00.000Z');
        expect(isoToZoned('2026-11-22T00:00:00.000Z', 'America/Chicago')).toBe('2026-11-21T18:00');
        expect(zonedToIso('2026-07-01T18:00', 'America/Chicago')).toBe('2026-07-01T23:00:00.000Z');
    });

    it('settles times on a daylight saving change day', () => {
        // Clocks in Chicago go back at 2 AM on Nov 1, 2026.
        expect(zonedToIso('2026-11-01T12:00', 'America/Chicago')).toBe('2026-11-01T18:00:00.000Z');
        expect(zonedToIso('2026-03-08T12:00', 'America/Chicago')).toBe('2026-03-08T17:00:00.000Z');
    });

    it('treats a date without a time as midnight', () => {
        expect(zonedToIso('2026-11-22', 'UTC')).toBe('2026-11-22T00:00:00.000Z');
    });

    it('knows the browser’s zone and the zone list', () => {
        expect(browserTimeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
        expect(TIME_ZONES).toContain('America/Chicago');
        expect(TIME_ZONES).toContain('UTC');
        expect(TIME_ZONES).toContain(browserTimeZone());
    });
});
