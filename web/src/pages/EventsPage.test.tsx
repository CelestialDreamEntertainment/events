import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { BOB, renderPage, summary } from '../../test/render';
import { EventsPage } from './EventsPage';

describe('EventsPage', () => {
    it('lists upcoming events with their badges and the viewer’s RSVP', async () => {
        renderPage(<EventsPage />, {
            fakes: {
                'GET /events': () => [
                    summary(),
                    summary({
                        id: 'e2',
                        title: 'Secret dinner',
                        location: '',
                        visibility: 'private',
                        cancelled: true,
                        myRsvp: { response: 'maybe', note: '' },
                        surprise: {
                            forName: 'Bob',
                            cover: {
                                title: 'Errands',
                                description: '',
                                location: '',
                                startsAt: '2026-11-22T00:30:00.000Z',
                                endsAt: '2026-11-22T02:00:00.000Z'
                            }
                        }
                    })
                ]
            }
        });
        expect(await screen.findByText('Game night')).toBeTruthy();
        expect(screen.getByText('The big house')).toBeTruthy();
        expect(screen.getByText('Cancelled')).toBeTruthy();
        expect(screen.getByText('Private')).toBeTruthy();
        expect(screen.getByText('Surprise')).toBeTruthy();
        expect(screen.getByText('Maybe')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Secret dinner' }).getAttribute('href')).toBe(
            '/events/e2'
        );
        expect(screen.getByRole('link', { name: 'New event' })).toBeTruthy();
    });

    it('switches to past events and says when there are none', async () => {
        const asked: unknown[] = [];
        renderPage(<EventsPage />, {
            user: BOB,
            fakes: {
                'GET /events': (options) => {
                    asked.push(options.query?.when);
                    return [];
                }
            }
        });
        expect(await screen.findByText('Nothing planned yet.')).toBeTruthy();
        expect(screen.queryByRole('link', { name: 'New event' })).toBeNull();
        await userEvent.click(screen.getByText('Past'));
        expect(await screen.findByText('No past events.')).toBeTruthy();
        expect(asked).toEqual(['upcoming', 'past']);
    });

    it('shows a load error', async () => {
        renderPage(<EventsPage />, {
            fakes: {
                'GET /events': () => {
                    throw new Error('Network down');
                }
            }
        });
        expect(await screen.findByText('Network down')).toBeTruthy();
    });
});
