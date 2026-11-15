import '@mantine/core/styles.css';
import { createRoot } from 'react-dom/client';
import { api, auth } from './api';
import { App } from './App';

createRoot(document.getElementById('root') as HTMLElement).render(<App auth={auth} api={api} />);
