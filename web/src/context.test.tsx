import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useApi } from './context';

describe('useApi', () => {
    it('fails loudly without a provider', () => {
        expect(() => renderHook(() => useApi())).toThrow('useApi needs an <ApiProvider>');
    });
});
