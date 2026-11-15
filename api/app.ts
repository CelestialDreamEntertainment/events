import { defineApp, route } from '@sbwp/runtime';

export default defineApp({
    name: 'events',
    scopes: ['events:guest', 'events:host'],
    baseScope: 'events:guest',
    routes: [
        route('GET', '/events', './handlers/listEvents'),
        route('POST', '/events', './handlers/createEvent', { scopes: ['events:host'] }),
        route('GET', '/events/:id', './handlers/getEvent'),
        route('PUT', '/events/:id', './handlers/updateEvent', { scopes: ['events:host'] }),
        route('POST', '/events/:id/cancel', './handlers/cancelEvent', { scopes: ['events:host'] }),
        route('PUT', '/events/:id/rsvp', './handlers/setRsvp'),
        route('DELETE', '/events/:id/rsvp', './handlers/deleteRsvp'),
        route('GET', '/health', './handlers/health', { public: true })
    ]
});
