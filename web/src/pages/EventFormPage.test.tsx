import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@sbwp/web';
import { describe, expect, it } from 'vitest';
import { detail, renderPage } from '../../test/render';
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
                invitees: ['bob@test']
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
