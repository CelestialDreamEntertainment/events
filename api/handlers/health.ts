import { definePublicHandler } from '@sbwp/runtime';
import app from '../app';

export const handler = definePublicHandler(app, {}, () => ({ ok: true as const }));
