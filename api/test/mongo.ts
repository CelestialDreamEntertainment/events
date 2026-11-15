import { MongoMemoryServer } from 'mongodb-memory-server';

/** Vitest global setup: one in-memory Mongo for the API tests. Each test file uses its own database. */
export default async () => {
    const mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    return async () => {
        await mongo.stop();
    };
};
