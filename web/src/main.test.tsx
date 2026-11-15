import { describe, expect, it, vi } from 'vitest';

const render = vi.fn();
vi.mock('react-dom/client', () => ({ createRoot: () => ({ render }) }));

describe('main', () => {
    it('renders the app into #root', async () => {
        document.body.innerHTML = '<div id="root"></div>';
        await import('./main');
        expect(render).toHaveBeenCalledOnce();
    });
});
