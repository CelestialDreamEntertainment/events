import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeApiClient, fakeAuthClient } from '@sbwp/web/testing';
import { describe, expect, it } from 'vitest';
import type { Routes as ApiRoutes } from '../../api/routes.gen';
import { ALICE, BOB, detail, renderPage } from '../test/render';
import type { Scope } from './api';
import { App, Routes } from './App';

describe('App', () => {
    it('shows the signed-in user and signs out', async () => {
        const auth = fakeAuthClient<Scope>(ALICE);
        render(<App auth={auth} api={fakeApiClient<ApiRoutes>({ 'GET /events': () => [] })} />);
        expect(await screen.findByText('Alice')).toBeTruthy();
        await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
        expect(auth.getState().status).toBe('signedOut');
    });

    it('falls back to the email when the user has no name', async () => {
        render(
            <App
                auth={fakeAuthClient<Scope>(BOB)}
                api={fakeApiClient<ApiRoutes>({ 'GET /events': () => [] })}
            />
        );
        expect(await screen.findByText('bob@test')).toBeTruthy();
    });
});

describe('Routes', () => {
    it('routes to each page', async () => {
        const fakes = { 'GET /events/:id': () => detail() };
        renderPage(<Routes />, { path: '/new' });
        expect(await screen.findByRole('heading', { name: 'New event' })).toBeTruthy();
        renderPage(<Routes />, { path: '/events/e1/edit', fakes });
        expect(await screen.findByRole('heading', { name: 'Edit event' })).toBeTruthy();
        renderPage(<Routes />, { path: '/events/e1', fakes });
        expect(await screen.findByRole('heading', { name: 'Game night' })).toBeTruthy();
        renderPage(<Routes />, { path: '/somewhere' });
        expect(screen.getByText('Page not found.')).toBeTruthy();
    });

    it('keeps guests out of host pages', () => {
        renderPage(<Routes />, { path: '/new', user: BOB });
        expect(screen.getByText('Only hosts can do that.')).toBeTruthy();
    });
});
