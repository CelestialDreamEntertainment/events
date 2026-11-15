import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@sbwp/web';
import { describe, expect, it } from 'vitest';
import { detail, renderPage } from '../../test/render';
import { browserTimeZone, zonedToIso } from '../zones';
import { EditEventPage, NewEventPage } from './EventFormPage';

const fillWhen = (starts: string, ends: string) => {
    fireEvent.change(screen.getByLabelText(/^Starts/), { target: { value: starts } });
    fireEvent.change(screen.getByLabelText(/^Ends/), { target: { value: ends } });
};

describe('NewEventPage', () => {
    it('creates a private event for invited guests and opens it', async () => {
        const sent: unknown[] = [];
        const { location } = renderPage(<NewEventPage />, {
            path: '/new',
            fakes: {
                'POST /events': (options) => {
                    sent.push(options.body);
                    return detail({ id: 'new-id' });
                }
            }
        });
        await userEvent.type(screen.getByLabelText(/^Title/), 'Game night');
        fillWhen('2026-11-21T18:00', '2026-11-21T21:00');
        const zone = screen.getByRole('combobox', { name: 'Time zone' });
        await userEvent.clear(zone);
        await userEvent.type(zone, 'Chicago');
        await userEvent.click(await screen.findByRole('option', { name: 'America/Chicago' }));
        await userEvent.type(screen.getByLabelText('Location'), 'The big house');
        await userEvent.type(screen.getByLabelText('Details'), 'Bring snacks');
        await userEvent.click(screen.getByText('Only invited guests'));
        await userEvent.type(
            screen.getByRole('combobox', { name: 'Invited guests' }),
            'bob@test{Enter}'
        );
        await userEvent.click(screen.getByRole('button', { name: 'Create event' }));
        await screen.findByRole('button', { name: 'Create event' });
        expect(sent).toEqual([
            {
                title: 'Game night',
                description: 'Bring snacks',
                location: 'The big house',
                startsAt: '2026-11-22T00:00:00.000Z',
                endsAt: '2026-11-22T03:00:00.000Z',
                timeZone: 'America/Chicago',
                visibility: 'private',
                invitees: ['bob@test'],
                surprise: null
            }
        ]);
        expect(location.history).toEqual(['/new', '/events/new-id']);
    });

    it('drops invitees from a public event', async () => {
        const sent: unknown[] = [];
        renderPage(<NewEventPage />, {
            fakes: {
                'POST /events': (options) => {
                    sent.push(options.body);
                    return detail();
                }
            }
        });
        await userEvent.type(screen.getByLabelText(/^Title/), 'Picnic');
        fillWhen('2026-11-21T12:00', '2026-11-21T15:00');
        await userEvent.click(screen.getByText('Only invited guests'));
        await userEvent.type(
            screen.getByRole('combobox', { name: 'Invited guests' }),
            'bob@test{Enter}'
        );
        await userEvent.click(screen.getByText('Everyone'));
        expect(screen.queryByRole('combobox', { name: 'Invited guests' })).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: 'Create event' }));
        expect(sent[0]).toMatchObject({ visibility: 'public', invitees: [] });
    });

    it('asks for both times before sending', async () => {
        renderPage(<NewEventPage />);
        await userEvent.type(screen.getByLabelText(/^Title/), 'Picnic');
        fireEvent.submit(screen.getByRole('button', { name: 'Create event' }));
        expect(await screen.findByText('Pick a start and an end.')).toBeTruthy();
    });

    it('shows validation issues and plain errors from the API', async () => {
        let fail: Error = new ApiError(400, 'invalid', 'Invalid', [
            { path: 'endsAt', message: 'Must be after the start' }
        ]);
        renderPage(<NewEventPage />, {
            fakes: {
                'POST /events': () => {
                    throw fail;
                }
            }
        });
        await userEvent.type(screen.getByLabelText(/^Title/), 'Picnic');
        fillWhen('2026-11-21T12:00', '2026-11-21T11:00');
        await userEvent.click(screen.getByRole('button', { name: 'Create event' }));
        expect(await screen.findByText('endsAt: Must be after the start')).toBeTruthy();
        fail = new ApiError(500, 'internal', 'Something broke', []);
        await userEvent.click(screen.getByRole('button', { name: 'Create event' }));
        expect(await screen.findByText('Something broke')).toBeTruthy();
        fail = new Error('Network down');
        await userEvent.click(screen.getByRole('button', { name: 'Create event' }));
        expect(await screen.findByText('Network down')).toBeTruthy();
    });

    it('goes back to the calendar', async () => {
        const { location } = renderPage(<NewEventPage />, { path: '/new' });
        await userEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(location.history.at(-1)).toBe('/');
    });
});

describe('surprise parties in the form', () => {
    it('creates a surprise with a cover story that starts at the real time and place', async () => {
        const sent: unknown[] = [];
        renderPage(<NewEventPage />, {
            fakes: {
                'POST /events': (options) => {
                    sent.push(options.body);
                    return detail();
                }
            }
        });
        await userEvent.type(screen.getByLabelText(/^Title/), 'Bob’s party');
        fillWhen('2026-11-21T18:00', '2026-11-21T21:00');
        await userEvent.type(screen.getByLabelText('Location'), 'The big house');
        await userEvent.click(screen.getByLabelText(/Surprise party/));
        expect((screen.getByLabelText(/^Cover starts/) as HTMLInputElement).value).toBe(
            '2026-11-21T18:00'
        );
        expect((screen.getByLabelText('Cover location') as HTMLInputElement).value).toBe(
            'The big house'
        );
        await userEvent.type(screen.getByLabelText(/^Who it’s for/), 'Bob');
        await userEvent.type(
            screen.getByRole('combobox', { name: 'Their emails' }),
            'bob@test{Enter}'
        );
        await userEvent.type(screen.getByLabelText(/^Cover title/), 'Quiet dinner');
        fireEvent.change(screen.getByLabelText(/^Cover starts/), {
            target: { value: '2026-11-21T18:30' }
        });
        fireEvent.change(screen.getByLabelText(/^Cover ends/), {
            target: { value: '2026-11-21T20:00' }
        });
        await userEvent.clear(screen.getByLabelText('Cover location'));
        await userEvent.type(screen.getByLabelText('Cover location'), 'Alice’s place');
        await userEvent.type(screen.getByLabelText('Cover details'), 'Just us');
        await userEvent.click(screen.getByRole('button', { name: 'Create event' }));
        await screen.findByRole('button', { name: 'Create event' });
        expect(sent[0]).toMatchObject({
            surprise: {
                for: ['bob@test'],
                forName: 'Bob',
                cover: {
                    title: 'Quiet dinner',
                    description: 'Just us',
                    location: 'Alice’s place',
                    startsAt: zonedToIso('2026-11-21T18:30', browserTimeZone()),
                    endsAt: zonedToIso('2026-11-21T20:00', browserTimeZone())
                }
            }
        });
    });

    it('keeps cover fields already filled in, and needs cover times', async () => {
        renderPage(<NewEventPage />);
        await userEvent.type(screen.getByLabelText(/^Title/), 'Party');
        await userEvent.click(screen.getByLabelText(/Surprise party/));
        await userEvent.type(screen.getByLabelText('Cover location'), 'Somewhere');
        await userEvent.click(screen.getByLabelText(/Surprise party/));
        expect(screen.queryByLabelText('Cover location')).toBeNull();
        await userEvent.type(screen.getByLabelText('Location'), 'Elsewhere');
        await userEvent.click(screen.getByLabelText(/Surprise party/));
        expect((screen.getByLabelText('Cover location') as HTMLInputElement).value).toBe(
            'Somewhere'
        );
        fillWhen('2026-11-21T18:00', '2026-11-21T21:00');
        fireEvent.submit(screen.getByRole('button', { name: 'Create event' }));
        expect(
            await screen.findByText('Pick a start and an end for the cover story.')
        ).toBeTruthy();
    });

    it('loads a surprise for editing', async () => {
        const cover = {
            title: 'Quiet dinner',
            description: 'Just us',
            location: 'Alice’s place',
            startsAt: '2026-11-22T00:30:00.000Z',
            endsAt: '2026-11-22T02:00:00.000Z'
        };
        renderPage(<EditEventPage id="e1" />, {
            fakes: {
                'GET /events/:id': () =>
                    detail({ isHost: true, surprise: { forName: 'Bob', for: ['bob@test'], cover } })
            }
        });
        expect(((await screen.findByLabelText(/^Cover title/)) as HTMLInputElement).value).toBe(
            'Quiet dinner'
        );
        expect((screen.getByLabelText(/^Cover starts/) as HTMLInputElement).value).toBe(
            '2026-11-21T18:30'
        );
        expect(screen.getByText('bob@test')).toBeTruthy();
    });

    it('loads a surprise without the emails for a host who isn’t this event’s', async () => {
        renderPage(<EditEventPage id="e1" />, {
            fakes: {
                'GET /events/:id': () =>
                    detail({
                        surprise: {
                            forName: 'Bob',
                            cover: { ...detail(), description: '', location: '' }
                        }
                    })
            }
        });
        expect(((await screen.findByLabelText(/^Who it’s for/)) as HTMLInputElement).value).toBe(
            'Bob'
        );
    });
});

describe('EditEventPage', () => {
    it('loads the event in its own zone and saves changes', async () => {
        const sent: unknown[] = [];
        const { location } = renderPage(<EditEventPage id="e1" />, {
            path: '/events/e1/edit',
            fakes: {
                'GET /events/:id': () => detail({ visibility: 'private', invitees: ['bob@test'] }),
                'PUT /events/:id': (options) => {
                    sent.push(options);
                    return detail();
                }
            }
        });
        const title = await screen.findByLabelText(/^Title/);
        expect((screen.getByLabelText(/^Starts/) as HTMLInputElement).value).toBe(
            '2026-11-21T18:00'
        );
        expect(screen.getByText('bob@test')).toBeTruthy();
        await userEvent.clear(title);
        await userEvent.type(title, 'Board game night');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));
        await screen.findByRole('button', { name: 'Save' });
        expect(sent).toMatchObject([
            { params: { id: 'e1' }, body: { title: 'Board game night', invitees: ['bob@test'] } }
        ]);
        expect(location.history.at(-1)).toBe('/events/e1');
    });

    it('keeps an event with no invitee list editable', async () => {
        const { location } = renderPage(<EditEventPage id="e1" />, {
            fakes: { 'GET /events/:id': () => detail() }
        });
        await userEvent.click(await screen.findByRole('button', { name: 'Back' }));
        expect(location.history.at(-1)).toBe('/events/e1');
    });

    it('shows a load error', async () => {
        renderPage(<EditEventPage id="e1" />);
        expect(await screen.findByText('No fake for GET /events/:id')).toBeTruthy();
    });
});
