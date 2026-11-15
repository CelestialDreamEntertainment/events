import {
    createAuthClient,
    createClient,
    useUser as usePlatformUser,
    type TypedClient
} from '@sbwp/web';
import type { Routes } from '../../api/routes.gen';

export const SCOPES = ['events:guest', 'events:host'] as const;
export type Scope = (typeof SCOPES)[number];

export type Api = TypedClient<Routes>;

export const auth = createAuthClient<Scope>({ scopes: SCOPES });
export const api: Api = createClient<Routes>({ auth });

export const useUser = () => usePlatformUser<Scope>();

export type EventSummary = Awaited<ReturnType<typeof api.get<'/events'>>>[number];
export type EventDetail = Awaited<ReturnType<typeof api.get<'/events/:id'>>>;
export type EventBody = Parameters<typeof api.post<'/events'>>[1]['body'];
export type RsvpResponse = EventSummary['counts'] extends Record<infer K, number> ? K : never;
