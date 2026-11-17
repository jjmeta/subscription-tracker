import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { markOfflineReady } from './pwa/status';
import { AppStateProvider } from './state/AppState';
import './styles.css';

registerSW({
  immediate: true,
  onOfflineReady() {
    markOfflineReady();
  },
});

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="splash">
          <h1>Something went wrong</h1>
          <p>Your subscriptions are still on this device. Reload the page.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Boundary>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </Boundary>
    </StrictMode>,
  );
}
