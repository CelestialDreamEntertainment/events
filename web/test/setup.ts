import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom lacks the browser APIs Mantine uses for color schemes, popovers and textareas.
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false
    })
});

class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
window.ResizeObserver = ResizeObserver;
Element.prototype.scrollIntoView = () => undefined;
Object.defineProperty(document, 'fonts', {
    value: { addEventListener: () => undefined, removeEventListener: () => undefined }
});

afterEach(cleanup);
