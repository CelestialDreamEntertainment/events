import { createContext, useContext, type ReactNode } from 'react';
import type { Api } from './api';

const ApiContext = createContext<Api | undefined>(undefined);

/** Lets tests swap in a fake API client. */
export const ApiProvider = ({ api, children }: { api: Api; children: ReactNode }) => (
    <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
);

export const useApi = (): Api => {
    const api = useContext(ApiContext);
    if (!api) {
        throw new Error('useApi needs an <ApiProvider> above it');
    }
    return api;
};
