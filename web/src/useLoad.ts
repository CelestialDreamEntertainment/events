import { useCallback, useEffect, useState } from 'react';

export type Loaded<T> =
    | { readonly status: 'loading' }
    | { readonly status: 'error'; readonly error: Error }
    | { readonly status: 'ready'; readonly data: T };

/** Loads data on mount and whenever `key` changes. `set` replaces it, e.g. with a mutation's result. */
export const useLoad = <T>(load: () => Promise<T>, key: string) => {
    const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
    const run = useCallback(() => {
        let current = true;
        setState({ status: 'loading' });
        load().then(
            (data) => current && setState({ status: 'ready', data }),
            (error: unknown) => current && setState({ status: 'error', error: error as Error })
        );
        return () => {
            current = false;
        };
    }, [key]);
    useEffect(run, [run]);
    return { state, set: (data: T) => setState({ status: 'ready', data }) };
};
