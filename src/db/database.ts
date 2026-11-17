import type { Settings, Subscription } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';

const DB_NAME = 'subscription-tracker';
const DB_VERSION = 1;

type SettingsRecord = Settings & { id: 'settings' };

let databasePromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The on-device database request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('The on-device save was aborted.')));
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('The on-device save failed.')));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser cannot store subscriptions on the device.'));
  }
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('subscriptions')) db.createObjectStore('subscriptions', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        databasePromise = null;
        reject(request.error ?? new Error('Could not open the on-device database.'));
      };
    });
  }
  return databasePromise;
}

export async function loadRaw(): Promise<{ subscriptions: unknown[]; settings: Settings }> {
  const db = await openDatabase();
  const transaction = db.transaction(['subscriptions', 'meta'], 'readonly');
  const done = transactionDone(transaction);
  const subscriptions = await requestToPromise(transaction.objectStore('subscriptions').getAll());
  const record = await requestToPromise(transaction.objectStore('meta').get('settings') as IDBRequest<SettingsRecord | undefined>);
  await done;
  return {
    subscriptions: Array.isArray(subscriptions) ? subscriptions : [],
    settings: record
      ? { defaultLeadDays: record.defaultLeadDays, exchangeRates: record.exchangeRates ?? {} }
      : { ...DEFAULT_SETTINGS, exchangeRates: {} },
  };
}

export async function saveSubscription(subscription: Subscription): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction('subscriptions', 'readwrite');
  const done = transactionDone(transaction);
  transaction.objectStore('subscriptions').put(subscription);
  await done;
}

export async function saveSubscriptions(subscriptions: Subscription[]): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction('subscriptions', 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore('subscriptions');
  for (const subscription of subscriptions) store.put(subscription);
  await done;
}

export async function deleteSubscriptions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDatabase();
  const transaction = db.transaction('subscriptions', 'readwrite');
  const done = transactionDone(transaction);
  const store = transaction.objectStore('subscriptions');
  for (const id of ids) store.delete(id);
  await done;
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction('meta', 'readwrite');
  const done = transactionDone(transaction);
  const record: SettingsRecord = { id: 'settings', ...settings };
  transaction.objectStore('meta').put(record);
  await done;
}

export async function replaceAll(subscriptions: Subscription[], settings: Settings): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(['subscriptions', 'meta'], 'readwrite');
  const done = transactionDone(transaction);
  const subscriptionsStore = transaction.objectStore('subscriptions');
  subscriptionsStore.clear();
  for (const subscription of subscriptions) subscriptionsStore.put(subscription);
  const record: SettingsRecord = { id: 'settings', ...settings };
  transaction.objectStore('meta').put(record);
  await done;
}

export async function requestPersistentStorage(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Persistent storage is a hint. The data still lives in IndexedDB.
  }
}
