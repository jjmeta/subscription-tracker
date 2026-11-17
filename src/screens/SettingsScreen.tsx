import { useEffect, useState } from 'react';
import { ScreenHeader, Section, Stepper, type ConfirmRequest } from '../components/ui';
import { serializeBackup, parseBackupText } from '../domain/backup';
import { foreignCurrencies, parseRate } from '../domain/money';
import type { BackupData } from '../domain/types';
import { BACKUP_FORMAT, BACKUP_VERSION, HOME_CURRENCY } from '../domain/types';
import { deliverFile, isIos, isSafari, isStandalone } from '../lib/files';
import { subscribeOfflineReady } from '../pwa/status';
import { useAppState } from '../state/AppState';

export function SettingsScreen({
  ask,
  onCalendar,
  onDownload,
  onLoadExamples,
}: {
  ask: (request: ConfirmRequest) => void;
  onCalendar: () => void;
  onDownload: () => void;
  onLoadExamples: () => void;
}) {
  const { subscriptions, settings, today, changeSettings, importData, removeExamples, clearAll, notify } = useAppState();
  const [offlineReady, setOfflineReady] = useState(false);
  const [standalone] = useState(() => isStandalone());
  const currencies = foreignCurrencies(subscriptions);
  const hasSamples = subscriptions.some((subscription) => subscription.sample);
  const active = subscriptions.some((subscription) => subscription.status === 'active');

  useEffect(() => subscribeOfflineReady(setOfflineReady), []);

  const setLead = (defaultLeadDays: number) => {
    void changeSettings({ ...settings, defaultLeadDays });
  };

  const setRate = (currency: string, rate: number | null) => {
    const exchangeRates = { ...settings.exchangeRates };
    if (rate == null) delete exchangeRates[currency];
    else exchangeRates[currency] = rate;
    void changeSettings({ ...settings, exchangeRates });
  };

  const exportBackup = async () => {
    const data: BackupData = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      subscriptions,
      settings,
    };
    const result = await deliverFile({
      filename: `subscriptions-${today}.json`,
      mime: 'application/json',
      content: serializeBackup(data),
    });
    if (result === 'cancelled') return;
    notify(result === 'shared' ? 'Backup ready in the share sheet. Keep a copy somewhere safe.' : 'Backup downloaded. Keep a copy somewhere safe.');
  };

  const importBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        const parsed = parseBackupText(text);
        if (!parsed.ok) {
          ask({
            title: 'Can’t import that file',
            message: parsed.errors.join('\n'),
            actions: [],
          });
          return;
        }
        const count = parsed.data.subscriptions.length;
        ask({
          title: `Import ${count} subscription${count === 1 ? '' : 's'}?`,
          message: 'Merge keeps what is already on this device and updates matching ids. Replace removes everything here first, including settings.',
          actions: [
            { label: 'Merge', tone: 'primary', onClick: () => void importData(parsed.data, 'merge') },
            {
              label: 'Replace',
              tone: 'danger',
              onClick: () => {
                if (!subscriptions.length) {
                  void importData(parsed.data, 'replace');
                  return;
                }
                ask({
                  title: 'Replace everything on this device?',
                  message: 'Subscriptions and exchange rates stored here will be deleted and replaced by the file. Export a backup first if you might want them back.',
                  actions: [{ label: 'Replace all data', tone: 'danger', onClick: () => void importData(parsed.data, 'replace') }],
                });
              },
            },
          ],
        });
      });
    };
    input.click();
  };

  return (
    <div className="screen">
      <ScreenHeader title="Settings" subtitle="Stored only on this device" />
      {!standalone ? (
        <Section
          title="Install on iPhone"
          footer={
            isIos() && !isSafari()
              ? 'Other browsers on iPhone cannot add a real Home Screen app. Open this page in Safari.'
              : 'Data entered in Safari is separate from the Home Screen app. Export a backup here, then import it after installing if the new icon looks empty.'
          }
        >
          <ol className="steps">
            <li>Open this page in Safari.</li>
            <li>Tap Share.</li>
            <li>Tap Add to Home Screen, then Add.</li>
          </ol>
        </Section>
      ) : (
        <Section title="Home Screen" footer="You’re using the installed app. Safari keeps a separate copy of the data.">
          <p className="info-copy">Installed</p>
        </Section>
      )}
      <Section
        title="Reminder"
        footer="The in-app list uses this window. Calendar alerts use it too, at 9:00am Australia/Brisbane. A subscription can override it. The Home Screen badge counts renewals inside the window and updates when you open the app."
      >
        <div className="field">
          <span>Days before</span>
          <Stepper label="Default days before a renewal" min={0} max={60} value={settings.defaultLeadDays} onChange={setLead} />
        </div>
      </Section>
      <Section
        title="Exchange rates"
        footer={`Enter how many ${HOME_CURRENCY} you get for 1 unit of another currency. Nothing is downloaded. AUD totals use the rate you type.`}
      >
        {currencies.length === 0 ? <p className="info-copy">No foreign-currency subscriptions yet.</p> : null}
        {currencies.map((currency) => (
          <RateRow key={currency} currency={currency} rate={settings.exchangeRates[currency]} onSave={(rate) => setRate(currency, rate)} />
        ))}
      </Section>
      <Section
        title="Calendar"
        footer="There is no server, so this app cannot send push notifications. A single .ics file adds every active renewal, with the right repeat rule and an alert for the reminder window. Importing the file again usually duplicates events in Apple Calendar, so delete the old ones first."
      >
        <button type="button" className="sheet-action primary" onClick={onCalendar} disabled={!active}>
          Add all to Calendar
        </button>
        <button type="button" className="sheet-action" onClick={onDownload} disabled={!active}>
          Download .ics
        </button>
      </Section>
      <Section title="Backup" footer="The file is plain JSON. It never leaves this device unless you share or save it yourself.">
        <button type="button" className="sheet-action primary" onClick={() => void exportBackup()} disabled={!subscriptions.length && !Object.keys(settings.exchangeRates).length}>
          Export backup
        </button>
        <button type="button" className="sheet-action" onClick={importBackup}>
          Import backup
        </button>
      </Section>
      <Section title="Examples" footer="Invented names and prices, for trying the screens. They are not loaded until you ask.">
        <button type="button" className="sheet-action" onClick={onLoadExamples}>
          Load fictional examples
        </button>
        {hasSamples ? (
          <button
            type="button"
            className="sheet-action danger"
            onClick={() =>
              ask({
                title: 'Remove fictional examples?',
                message: 'This deletes invented subscriptions that are still examples. Ones you have edited are kept.',
                actions: [{ label: 'Remove examples', tone: 'danger', onClick: () => void removeExamples() }],
              })
            }
          >
            Remove fictional examples
          </button>
        ) : null}
      </Section>
      <Section title="On this device">
        <p className="info-copy">{offlineReady ? 'Saved for offline use after the first visit.' : 'Open it once online and it keeps working offline.'}</p>
        <button
          type="button"
          className="sheet-action danger"
          onClick={() =>
            ask({
              title: 'Erase everything on this device?',
              message: 'This deletes every subscription and setting in this app. Calendar events already added stay in Calendar. Export a backup first if you might want the list back.',
              actions: [{ label: 'Erase all data', tone: 'danger', onClick: () => void clearAll() }],
            })
          }
        >
          Erase all data
        </button>
      </Section>
    </div>
  );
}

function RateRow({ currency, rate, onSave }: { currency: string; rate: number | undefined; onSave: (rate: number | null) => void }) {
  const [value, setValue] = useState(rate != null ? String(rate) : '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setValue(rate != null ? String(rate) : '');
  }, [rate]);

  const commit = () => {
    if (!value.trim()) {
      setError(null);
      setValue(rate != null ? String(rate) : '');
      return;
    }
    const parsed = parseRate(value);
    if (parsed == null) {
      setError('Enter a rate greater than 0.');
      return;
    }
    setError(null);
    onSave(parsed);
  };

  return (
    <div>
      <label className="field">
        <span>1 {currency} =</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          inputMode="decimal"
          aria-label={`AUD per 1 ${currency}`}
          placeholder="0.00"
        />
        <span className="suffix">AUD</span>
      </label>
      {error ? <p className="field-error">{error}</p> : null}
      {rate != null ? (
        <button type="button" className="text-btn danger rate-clear" onClick={() => onSave(null)}>
          Clear {currency} rate
        </button>
      ) : null}
    </div>
  );
}
