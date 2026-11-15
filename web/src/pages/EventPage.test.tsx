import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@sbwp/web';
import { describe, expect, it } from 'vitest';
import { BOB, detail, renderPage } from '../../test/render';
import { EventPage } from './EventPage';

describe('EventPage', () => {
    it('shows a guest the details and records their RSVP with a note', async () => {
        const sent: unknown[] = [];
        renderPage(<EventPage id="e1" />, {
            user: BOB,
            fakes: {
                'GET /events/:id': () => detail(),
                'PUT /events/:id/rsvp': (options) => {
                    sent.push(options.body);
                    return detail({
                        counts: { going: 3, maybe: 1, no: 0 },
                        myRsvp: { response: 'going', note: 'On my way' }
                    });
                }
            }
        });
        expect(await screen.findByRole('heading', { name: 'Game night' })).toBeTruthy();
        expect(screen.getByText('Public')).toBeTruthy();
        expect(screen.getByText('Bring snacks')).toBeTruthy();
        expect(screen.getByText(/Hosted by Alice · 2 going · 1 maybe · 0 not going/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
        expect(screen.queryByText('RSVPs')).toBeNull();

        await userEvent.type(screen.getByLabelText('Note (optional)'), 'On my way');
        await userEvent.click(screen.getByRole('button', { name: 'Going' }));
        expect(await screen.findByText(/3 going/)).toBeTruthy();
        expect(sent).toEqual([{ response: 'going', note: 'On my way' }]);
        expect(screen.getByRole('button', { name: 'Going' }).getAttribute('aria-pressed')).toBe(
            'true'
        );
    });

    it('shows an RSVP error', async () => {
        renderPage(<EventPage id="e1" />, {
            user: BOB,
            fakes: {
                'GET /events/:id': () =>
                    detail({
                        myRsvp: { response: 'maybe', note: 'Maybe late' },
                        description: '',
                        location: ''
                    }),
                'PUT /events/:id/rsvp': () => {
                    throw new ApiError(409, 'conflict', 'This event is cancelled.');
                }
            }
        });
        expect(await screen.findByDisplayValue('Maybe late')).toBeTruthy();
        expect(screen.queryByText('Bring snacks')).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: 'Not going' }));
        expect(await screen.findByText('This event is cancelled.')).toBeTruthy();
    });

    it('gives the host RSVPs, invitees, edit and cancel', async () => {
        renderPage(<EventPage id="e1" />, {
            fakes: {
                'GET /events/:id': () =>
                    detail({
                        isHost: true,
                        visibility: 'private',
                        host: { name: null, email: 'alice@test' },
                        invitees: ['bob@test', 'carol@test'],
                        rsvps: [
                            { name: 'Bob', email: 'bob@test', response: 'going', note: 'Yay' },
                            { name: null, email: 'carol@test', response: 'no', note: '' }
                        ]
                    }),
                'POST /events/:id/cancel': () =>
                    detail({
                        isHost: true,
                        cancelled: true,
                        rsvps: [],
                        visibility: 'private',
                        invitees: []
                    })
            }
        });
        expect(await screen.findByText('Private')).toBeTruthy();
        expect(screen.getByText(/Hosted by alice@test/)).toBeTruthy();
        expect(screen.getByRole('cell', { name: 'Bob' })).toBeTruthy();
        expect(screen.getByRole('cell', { name: 'carol@test' })).toBeTruthy();
        expect(screen.getByRole('cell', { name: 'Not going' })).toBeTruthy();
        expect(screen.getByText('Invited: bob@test, carol@test')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(
            '/events/e1/edit'
        );

        await userEvent.click(screen.getByRole('button', { name: 'Cancel event' }));
        expect(await screen.findByText('This event is cancelled.')).toBeTruthy();
        expect(screen.getByText('Cancelled')).toBeTruthy();
        expect(screen.getByText('No RSVPs yet.')).toBeTruthy();
        expect(screen.getByText('Invited: nobody yet')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Cancel event' })).toBeNull();
    });

    it('shows a cancel error', async () => {
        renderPage(<EventPage id="e1" />, {
            fakes: {
                'GET /events/:id': () => detail({ isHost: true, invitees: [] }),
                'POST /events/:id/cancel': () => {
                    throw new Error('Try again');
                }
            }
        });
        await userEvent.click(await screen.findByRole('button', { name: 'Cancel event' }));
        expect(await screen.findByText('Try again')).toBeTruthy();
        expect(screen.queryByText(/Invited:/)).toBeNull();
    });

    it('explains a missing event and passes on other errors', async () => {
        renderPage(<EventPage id="nope" />, {
            fakes: {
                'GET /events/:id': () => {
                    throw new ApiError(404, 'not_found', 'Not found');
                }
            }
        });
        expect(await screen.findByText(/you’re not invited/)).toBeTruthy();
    });

    it('shows other load errors as they are', async () => {
        renderPage(<EventPage id="e1" />, {
            fakes: {
                'GET /events/:id': () => {
                    throw new ApiError(500, 'internal', 'Something broke');
                }
            }
        });
        expect(await screen.findByText('Something broke')).toBeTruthy();
    });
});
