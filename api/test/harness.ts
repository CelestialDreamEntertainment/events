import { randomUUID } from 'node:crypto';
import {
    closeDb,
    createLog,
    getDb,
    wrap,
    type ApiEvent,
    type Handler,
    type HttpMethod,
    type Schemas
} from '@sbwp/runtime';
import { afterAll } from 'vitest';

/** Obviously fake test users. Real friends' names and emails never go in tests. */
export const alice = {
    sub: 'u-alice',
    email: 'alice@test',
    name: 'Alice',
    scope: 'events:guest events:host'
};
export const bob = { sub: 'u-bob', email: 'bob@test', name: 'Bob', scope: 'events:guest' };
export const carol = { sub: 'u-carol', email: 'carol@test', scope: 'events:guest' };
export const dave = {
    sub: 'u-dave',
    email: 'dave@test',
    name: 'Dave',
    scope: 'events:guest events:host'
};

export type TestUser = typeof alice | typeof bob | typeof carol | typeof dave;

/** A fresh database per test file, on the in-memory Mongo from the global setup. */
export const testDb = () => {
    const db = getDb(`events-test-${randomUUID()}`);
    afterAll(async () => {
        await db.dropDatabase();
        await closeDb();
    });
    return db;
};

export type Call = {
    readonly user?: TestUser;
    readonly params?: Record<string, string>;
    readonly query?: Record<string, string>;
    readonly body?: unknown;
};

/**
 * Calls a handler the way API Gateway would: through the runtime wrapper, with claims, path
 * params, query and a JSON body. Returns the status and the parsed body.
 */
export const caller =
    (db: ReturnType<typeof getDb>) =>
    async <S extends Schemas, Scope extends string, Public extends boolean, Result>(
        handler: Handler<S, Scope, Public, Result>,
        route: { method: HttpMethod; path: string },
        call: Call = {}
        // Tests read response fields freely; the handlers' own types are checked by `tsc`.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<{ status: number; body: any }> => {
        const lambda = wrap(handler, route, { db: () => db, log: createLog({}, () => undefined) });
        const event: ApiEvent = {
            isBase64Encoded: false,
            ...(call.body === undefined ? {} : { body: JSON.stringify(call.body) }),
            ...(call.params ? { pathParameters: call.params } : {}),
            ...(call.query ? { queryStringParameters: call.query } : {}),
            requestContext: {
                requestId: randomUUID(),
                ...(call.user ? { authorizer: { jwt: { claims: call.user } } } : {})
            }
        };
        const result = await lambda(event);
        return {
            status: result.statusCode,
            body: result.body ? JSON.parse(result.body) : undefined
        };
    };
