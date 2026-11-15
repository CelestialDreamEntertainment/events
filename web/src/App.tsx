import { Button, Container, Group, MantineProvider, Text } from '@mantine/core';
import {
    AuthProvider,
    createAppTheme,
    cssVariablesResolver,
    RequireAuth,
    useAuth,
    type AuthClient
} from '@sbwp/web';
import { Route, Switch } from 'wouter';
import { useUser, type Api, type Scope } from './api';
import { ApiProvider } from './context';
import { EditEventPage, NewEventPage } from './pages/EventFormPage';
import { EventPage } from './pages/EventPage';
import { EventsPage } from './pages/EventsPage';

export const theme = createAppTheme('grape');

const Header = () => {
    const user = useUser();
    const auth = useAuth();
    return (
        <Group justify="flex-end" py="sm">
            <Text size="sm" c="dimmed">
                {user?.name ?? user?.email}
            </Text>
            <Button variant="subtle" size="xs" onClick={() => void auth.signOut()}>
                Sign out
            </Button>
        </Group>
    );
};

const HostOnly = ({ children }: { children: React.ReactNode }) =>
    useUser()?.has('events:host') ? children : <Text>Only hosts can do that.</Text>;

export const Routes = () => (
    <Switch>
        <Route path="/">
            <EventsPage />
        </Route>
        <Route path="/new">
            <HostOnly>
                <NewEventPage />
            </HostOnly>
        </Route>
        <Route path="/events/:id/edit">
            {(params) => (
                <HostOnly>
                    <EditEventPage id={params.id} />
                </HostOnly>
            )}
        </Route>
        <Route path="/events/:id">{(params) => <EventPage id={params.id} />}</Route>
        <Route>
            <Text>Page not found.</Text>
        </Route>
    </Switch>
);

export const App = ({ auth, api }: { auth: AuthClient<Scope>; api: Api }) => (
    <MantineProvider
        theme={theme}
        cssVariablesResolver={cssVariablesResolver}
        defaultColorScheme="auto"
    >
        <AuthProvider client={auth}>
            <ApiProvider api={api}>
                <Container size="sm" pb="xl">
                    <RequireAuth>
                        <Header />
                        <Routes />
                    </RequireAuth>
                </Container>
            </ApiProvider>
        </AuthProvider>
    </MantineProvider>
);
