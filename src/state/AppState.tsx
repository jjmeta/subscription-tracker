import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { mergeSettings, mergeSubscriptions, validateBackup } from '../domain/backup';
import { buildExamples } from '../domain/examples';
import { materialize, reminders } from '../domain/schedule';
import type { BackupData, Settings, Subscription } from '../domain/types';
import { BACKUP_FORMAT, BACKUP_VERSION, DEFAULT_SETTINGS } from '../domain/types';
import { todayInBrisbane } from '../domain/dates';
import {
  deleteSubscriptions,
  loadRaw,
  replaceAll,
  requestPersistentStorage,
  saveSettings,
  saveSubscription as putSubscription,
  saveSubscriptions,
} from '../db/database';
import { syncAppBadge } from '../lib/badge';

type AppContextValue = {
  ready: boolean;
  error: string | null;
  subscriptions: Subscription[];
  settings: Settings;
  today: string;
  notice: string | null;
  dismissNotice: () => void;
  notify: (message: string) => void;
  save: (subscription: Subscription) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  changeSettings: (settings: Settings) => Promise<boolean>;
  importData: (data: BackupData, mode: 'merge' | 'replace') => Promise<boolean>;
  loadExamples: () => Promise<number | null>;
  removeExamples: () => Promise<boolean>;
  clearAll: () => Promise<boolean>;
};

const AppContext = createContext<AppContextValue | null>(null);

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong on this device.';
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [today, setToday] = useState(() => todayInBrisbane());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const subscriptionsRef = useRef(subscriptions);
  const settingsRef = useRef(settings);
  subscriptionsRef.current = subscriptions;
  settingsRef.current = settings;

  const notify = useCallback((message: string) => setNotice(message), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const applyRoll = useCallback((items: Subscription[], todayNow: string) => {
    const rolled = items.map((subscription) => materialize(subscription, todayNow));
    const changed = rolled.some((subscription, index) => subscription !== items[index]);
    return { rolled, changed };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadRaw()
      .then(async (raw) => {
        const validated = validateBackup(
          {
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            subscriptions: raw.subscriptions,
            settings: raw.settings,
          },
          new Date().toISOString(),
        );
        if (!validated.ok) throw new Error(validated.errors[0] ?? 'Stored subscriptions could not be read.');
        const todayNow = todayInBrisbane();
        const { rolled, changed } = applyRoll(validated.data.subscriptions, todayNow);
        if (changed) await saveSubscriptions(rolled);
        if (cancelled) return;
        setSubscriptions(rolled);
        setSettings(validated.data.settings);
        setToday(todayNow);
        setReady(true);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(failureMessage(loadError));
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [applyRoll]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    const roll = () => {
      const todayNow = todayInBrisbane();
      setToday(todayNow);
      setSubscriptions((current) => {
        const { rolled, changed } = applyRoll(current, todayNow);
        if (!changed) return current;
        void saveSubscriptions(rolled);
        return rolled;
      });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') roll();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(roll, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [applyRoll]);

  useEffect(() => {
    if (!ready || error) return;
    void syncAppBadge(reminders(subscriptions, settings, today).length);
  }, [ready, error, subscriptions, settings, today]);

  const save = useCallback(async (subscription: Subscription) => {
    try {
      const next = materialize({ ...subscription, updatedAt: new Date().toISOString() }, todayInBrisbane());
      await putSubscription(next);
      await requestPersistentStorage();
      setToday(todayInBrisbane());
      setSubscriptions((current) => {
        const exists = current.some((item) => item.id === next.id);
        if (!exists) return [...current, next];
        return current.map((item) => (item.id === next.id ? next : item));
      });
      return true;
    } catch (saveError) {
      notify(failureMessage(saveError));
      return false;
    }
  }, [notify]);

  const remove = useCallback(async (id: string) => {
    try {
      await deleteSubscriptions([id]);
      setSubscriptions((current) => current.filter((item) => item.id !== id));
      return true;
    } catch (removeError) {
      notify(failureMessage(removeError));
      return false;
    }
  }, [notify]);

  const changeSettings = useCallback(async (next: Settings) => {
    try {
      await saveSettings(next);
      setSettings(next);
      return true;
    } catch (settingsError) {
      notify(failureMessage(settingsError));
      return false;
    }
  }, [notify]);

  const importData = useCallback(async (data: BackupData, mode: 'merge' | 'replace') => {
    try {
      const todayNow = todayInBrisbane();
      const incoming = data.subscriptions.map((subscription) => materialize(subscription, todayNow));
      const nextSubscriptions = mode === 'replace' ? incoming : mergeSubscriptions(subscriptionsRef.current, incoming);
      const nextSettings = mode === 'replace' ? data.settings : mergeSettings(settingsRef.current, data.settings);
      if (mode === 'replace') await replaceAll(nextSubscriptions, nextSettings);
      else {
        await saveSubscriptions(incoming);
        await saveSettings(nextSettings);
      }
      setSubscriptions(nextSubscriptions);
      setSettings(nextSettings);
      setToday(todayNow);
      notify(mode === 'replace' ? 'Replaced the subscriptions on this device.' : 'Merged the backup into this device.');
      return true;
    } catch (importError) {
      notify(failureMessage(importError));
      return false;
    }
  }, [notify]);

  const loadExamples = useCallback(async () => {
    try {
      const todayNow = todayInBrisbane();
      const existing = new Set(subscriptionsRef.current.map((subscription) => subscription.id));
      const missing = buildExamples(todayNow).filter((subscription) => !existing.has(subscription.id));
      if (!missing.length) return 0;
      await saveSubscriptions(missing);
      setSubscriptions((current) => [...current, ...missing]);
      setToday(todayNow);
      return missing.length;
    } catch (exampleError) {
      notify(failureMessage(exampleError));
      return null;
    }
  }, [notify]);

  const removeExamples = useCallback(async () => {
    try {
      const ids = subscriptionsRef.current.filter((subscription) => subscription.sample).map((subscription) => subscription.id);
      await deleteSubscriptions(ids);
      setSubscriptions((current) => current.filter((subscription) => !subscription.sample));
      return true;
    } catch (removeError) {
      notify(failureMessage(removeError));
      return false;
    }
  }, [notify]);

  const clearAll = useCallback(async () => {
    try {
      const fresh = { defaultLeadDays: DEFAULT_SETTINGS.defaultLeadDays, exchangeRates: {} };
      await replaceAll([], fresh);
      setSubscriptions([]);
      setSettings(fresh);
      notify('Erased the subscriptions on this device.');
      return true;
    } catch (clearError) {
      notify(failureMessage(clearError));
      return false;
    }
  }, [notify]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      error,
      subscriptions,
      settings,
      today,
      notice,
      dismissNotice,
      notify,
      save,
      remove,
      changeSettings,
      importData,
      loadExamples,
      removeExamples,
      clearAll,
    }),
    [
      ready,
      error,
      subscriptions,
      settings,
      today,
      notice,
      dismissNotice,
      notify,
      save,
      remove,
      changeSettings,
      importData,
      loadExamples,
      removeExamples,
      clearAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppState(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useAppState must be used within AppStateProvider');
  return value;
}
