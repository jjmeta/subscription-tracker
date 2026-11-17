import { useCallback, useEffect, useState } from 'react';
import { ActionSheet, type ConfirmRequest } from './components/ui';
import { TabBar } from './components/TabBar';
import { shareCalendar } from './lib/calendar';
import type { DeliverMode } from './lib/files';
import { parseHash, navigate, type Route } from './router';
import { DetailScreen } from './screens/DetailScreen';
import { EditScreen } from './screens/EditScreen';
import { ListScreen } from './screens/ListScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SpendScreen } from './screens/SpendScreen';
import { UpcomingScreen } from './screens/UpcomingScreen';
import { useAppState } from './state/AppState';
import type { Subscription } from './domain/types';
import { reminders } from './domain/schedule';

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);
  return route;
}

export function App() {
  const state = useAppState();
  const route = useRoute();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const ask = useCallback((request: ConfirmRequest) => setConfirm(request), []);
  const closeConfirm = useCallback(() => setConfirm(null), []);
  const dueCount = reminders(state.subscriptions, state.settings, state.today).length;
  const showTabs = route.name === 'list' || route.name === 'upcoming' || route.name === 'spend' || route.name === 'settings';

  useEffect(() => {
    const titles: Record<Route['name'], string> = {
      list: 'Subscriptions',
      upcoming: 'Upcoming',
      spend: 'Spend',
      settings: 'Settings',
      detail: 'Subscription',
      edit: 'Edit subscription',
    };
    document.title = titles[route.name];
  }, [route]);

  const share = useCallback(
    async (subscriptions: Subscription[], mode: DeliverMode, name?: string) => {
      const message = await shareCalendar(subscriptions, state.settings, mode, name);
      if (message) state.notify(message);
    },
    [state],
  );

  const loadExamples = useCallback(async () => {
    const count = await state.loadExamples();
    if (count == null) return;
    state.notify(
      count === 0
        ? 'Fictional examples are already on this device.'
        : `Added ${count} fictional subscription${count === 1 ? '' : 's'}.`,
    );
  }, [state]);

  if (!state.ready) {
    return (
      <div className="splash">
        <p className="splash-mark">Subscriptions</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="splash">
        <h1>Couldn’t open your subscriptions</h1>
        <p>{state.error}</p>
      </div>
    );
  }

  const detail = route.name === 'detail' ? state.subscriptions.find((subscription) => subscription.id === route.id) : undefined;
  const editing = route.name === 'edit' ? (route.id ? state.subscriptions.find((subscription) => subscription.id === route.id) ?? null : null) : undefined;

  return (
    <div className={showTabs ? 'app' : 'app no-tabs'}>
      {route.name === 'list' ? <ListScreen onLoadExamples={() => void loadExamples()} /> : null}
      {route.name === 'upcoming' ? <UpcomingScreen onCalendar={() => void share(state.subscriptions, 'auto')} /> : null}
      {route.name === 'spend' ? <SpendScreen /> : null}
      {route.name === 'settings' ? (
        <SettingsScreen
          ask={ask}
          onCalendar={() => void share(state.subscriptions, 'auto')}
          onDownload={() => void share(state.subscriptions, 'download')}
          onLoadExamples={() => void loadExamples()}
        />
      ) : null}
      {route.name === 'detail' && detail ? (
        <DetailScreen
          subscription={detail}
          ask={ask}
          onCalendar={(subscription) => void share([subscription], 'auto', subscription.name)}
          onDownload={(subscription) => void share([subscription], 'download', subscription.name)}
        />
      ) : null}
      {route.name === 'detail' && !detail ? (
        <div className="empty">
          <h2>Not on this device</h2>
          <p>That subscription isn’t stored here.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'list' })}>
            Back to subscriptions
          </button>
        </div>
      ) : null}
      {route.name === 'edit' && route.id && !editing ? (
        <div className="empty">
          <h2>Not on this device</h2>
          <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'list' })}>
            Back to subscriptions
          </button>
        </div>
      ) : null}
      {route.name === 'edit' && (route.id === null || editing) ? (
        <EditScreen
          existing={editing ?? null}
          ask={ask}
          onClose={() => navigate(editing ? { name: 'detail', id: editing.id } : { name: 'list' })}
          onSaved={(subscription) => navigate({ name: 'detail', id: subscription.id })}
        />
      ) : null}
      {showTabs ? <TabBar current={route.name} dueCount={dueCount} /> : null}
      {state.notice ? (
        <button type="button" className="toast" onClick={state.dismissNotice}>
          {state.notice}
        </button>
      ) : null}
      {confirm ? <ActionSheet request={confirm} onClose={closeConfirm} /> : null}
    </div>
  );
}
