import { describe, expect, it } from 'vitest';
import { formatRange } from './format';

describe('formatRange', () => {
    it('shows a same-day range once, in the event’s time zone', () => {
        expect(
            formatRange('2026-11-22T00:00:00Z', '2026-11-22T03:00:00Z', 'America/Chicago', 'en-US')
        ).toBe('Sat, Nov 21, 2026, 6:00 PM – 9:00 PM CST');
    });

    it('names both days when the event runs past midnight', () => {
        expect(formatRange('2026-11-22T22:00:00Z', '2026-11-23T02:00:00Z', 'UTC', 'en-US')).toBe(
            'Sun, Nov 22, 2026, 10:00 PM – Mon, Nov 23, 2026, 2:00 AM UTC'
        );
    });

    it('leaves the zone off when the locale has no name for it', () => {
        const parts = Intl.DateTimeFormat.prototype.formatToParts;
        Intl.DateTimeFormat.prototype.formatToParts = function () {
            return [];
        };
        try {
            expect(
                formatRange('2026-11-22T00:00:00Z', '2026-11-22T03:00:00Z', 'UTC', 'en-US')
            ).toBe('Sun, Nov 22, 2026, 12:00 AM – 3:00 AM');
        } finally {
            Intl.DateTimeFormat.prototype.formatToParts = parts;
        }
    });
});
