import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [react()],
    test: {
        projects: [
            {
                extends: true,
                test: {
                    name: 'api',
                    include: ['api/**/*.test.ts'],
                    environment: 'node',
                    globalSetup: ['api/test/mongo.ts']
                }
            },
            {
                extends: true,
                test: {
                    name: 'web',
                    include: ['web/**/*.test.{ts,tsx}'],
                    environment: 'jsdom',
                    setupFiles: ['web/test/setup.ts']
                }
            }
        ],
        coverage: {
            provider: 'v8',
            include: ['api/**', 'web/src/**'],
            exclude: ['**/*.test.{ts,tsx}', 'api/test/**', 'api/routes.gen.ts'],
            thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 }
        }
    }
});
