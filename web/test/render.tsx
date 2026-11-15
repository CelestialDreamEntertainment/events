import { MantineProvider } from '@mantine/core';
import { render } from '@testing-library/react';
import { AuthProvider } from '@sbwp/web';
import { fakeApiClient, fakeAuthClient, type FakeUserInput } from '@sbwp/web/testing';
import type { ReactNode } from 'react';
import { Router } from 'wouter';
import { memoryLocation } from 'wouter/memory-location';
import type { Routes } from '../../api/routes.gen';
import type { EventDetail, EventSummary, Scope } from '../src/api';
import { theme } from '../src/App';
import { ApiProvider } from '../src/context';

export const ALICE: FakeUserInput<Scope> = {
    id: 'alice',
    email: 'alice@test',
    name: 'Alice',
    scopes: ['events:guest', 'events:host']
};
export const BOB: FakeUserInput<Scope> = { id: 'bob', email: 'bob@test', scopes: ['events:guest'] };

export type Fakes = Parameters<typeof fakeApiClient<Routes>>[0];

/** Renders `ui` signed in as `user`, at `path`, with the given fake API routes. */
export const renderPage = (
    ui: ReactNode,
    {
        fakes = {},
        user = ALICE,
        path = '/'
    }: { fakes?: Fakes; user?: FakeUserInput<Scope>; path?: string } = {}
) => {
    const location = memoryLocation({ path, record: true });
    const auth = fakeAuthClient<Scope>(user);
    const result = render(
        <MantineProvider theme={theme} env="test">
            <AuthProvider client={auth}>
                <ApiProvider api={fakeApiClient<Routes>(fakes)}>
                    <Router hook={location.hook}>{ui}</Router>
                </ApiProvider>
            </AuthProvider>
        </MantineProvider>
    );
    return { ...result, location, auth };
};

export const summary = (overrides: Partial<EventSummary> = {}): EventSummary => ({
    id: 'e1',
    title: 'Game night',
    description: 'Bring snacks',
    location: 'The big house',
    startsAt: '2026-11-22T00:00:00.000Z',
    endsAt: '2026-11-22T03:00:00.000Z',
    timeZone: 'America/Chicago',
    visibility: 'public',
    host: { name: 'Alice', email: 'alice@test' },
    isHost: false,
    cancelled: false,
    counts: { going: 2, maybe: 1, no: 0 },
    myRsvp: null,
    ...overrides
});

export const detail = (overrides: Partial<EventDetail> = {}): EventDetail => ({
    ...summary(),
    ...overrides
});
