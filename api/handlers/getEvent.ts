import { defineHandler } from '@sbwp/runtime';
import app from '../app';
import { eventDetail, findVisible } from '../lib/access';
import { idParams } from '../lib/model';

export const handler = defineHandler(app, { params: idParams }, async ({ params, user }, ctx) =>
    eventDetail(ctx, await findVisible(ctx, params.id, user), user)
);
