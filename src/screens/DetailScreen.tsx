import { billingDayNote, describeCycle, effectiveLead } from '../domain/schedule';
import { formatLongDate, relativeLabel } from '../domain/dates';
import { formatMoney } from '../domain/money';
import { initials } from '../domain/present';
import type { Subscription } from '../domain/types';
import { navigate } from '../router';
import { useAppState } from '../state/AppState';
import type { ConfirmRequest } from '../components/ui';
import { IconChevron } from '../components/icons';

export function DetailScreen({
  subscription,
  ask,
  onCalendar,
  onDownload,
}: {
  subscription: Subscription;
  ask: (request: ConfirmRequest) => void;
  onCalendar: (subscription: Subscription) => void;
  onDownload: (subscription: Subscription) => void;
}) {
  const { settings, today, save, remove } = useAppState();
  const lead = effectiveLead(subscription, settings);
  const note = billingDayNote(subscription.cycle, subscription.anchorDate);
  const active = subscription.status === 'active';

  const setStatus = (status: Subscription['status']) => {
    void save({ ...subscription, status, sample: false });
  };

  return (
    <div className="screen">
      <header className="bar">
        <button type="button" className="text-btn back" onClick={() => navigate({ name: 'list' })}>
          <IconChevron />
          Subs
        </button>
        <button type="button" className="text-btn" onClick={() => navigate({ name: 'edit', id: subscription.id })}>
          Edit
        </button>
      </header>
      <div className="hero">
        <div className="avatar lg">{initials(subscription.name)}</div>
        <h1>{subscription.name}</h1>
        <p className="hero-amount">{formatMoney(subscription.amount, subscription.currency)}</p>
        <p className="hero-sub">
          {describeCycle(subscription.cycle)} · {subscription.category}
        </p>
        {subscription.sample ? <p className="pill">Fictional example</p> : null}
        {!active ? <p className="pill">Cancelled</p> : null}
      </div>
      <section className="section">
        <div className="group">
          <div className="info-row">
            <span>Next renewal</span>
            <strong>
              {active ? relativeLabel(today, subscription.nextRenewal) : 'Paused'}
              <small>{formatLongDate(subscription.nextRenewal)}</small>
            </strong>
          </div>
          {note ? (
            <div className="info-row">
              <span>Schedule</span>
              <strong>{note}</strong>
            </div>
          ) : null}
          <div className="info-row">
            <span>Reminder</span>
            <strong>{lead === 0 ? 'On the day' : `${lead} day${lead === 1 ? '' : 's'} before`}</strong>
          </div>
          <div className="info-row">
            <span>Payment</span>
            <strong>{subscription.paymentMethod || 'Not set'}</strong>
          </div>
        </div>
      </section>
      {subscription.notes ? (
        <section className="section">
          <h2 className="section-label">Notes</h2>
          <div className="group">
            <p className="notes-block">{subscription.notes}</p>
          </div>
        </section>
      ) : null}
      {active ? (
        <>
          <button type="button" className="btn btn-primary" onClick={() => onCalendar(subscription)}>
            Add to Calendar
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => onDownload(subscription)}>
            Download .ics
          </button>
        </>
      ) : null}
      <section className="section">
        <div className="group">
          {active ? (
            <button
              type="button"
              className="sheet-action danger"
              onClick={() =>
                ask({
                  title: `Cancel ${subscription.name}?`,
                  message: 'It drops out of totals, upcoming charges, and calendar exports. You can reactivate it later. Events already in Calendar stay there until you delete them.',
                  actions: [{ label: 'Mark as cancelled', tone: 'danger', onClick: () => setStatus('cancelled') }],
                })
              }
            >
              Mark as cancelled
            </button>
          ) : (
            <button type="button" className="sheet-action primary" onClick={() => setStatus('active')}>
              Reactivate
            </button>
          )}
          <button
            type="button"
            className="sheet-action danger"
            onClick={() =>
              ask({
                title: `Delete ${subscription.name}?`,
                message: 'This removes it from this device. It cannot be undone.',
                  actions: [
                    {
                      label: 'Delete subscription',
                      tone: 'danger',
                      onClick: () => {
                        void remove(subscription.id).then((ok) => {
                          if (ok) navigate({ name: 'list' });
                        });
                      },
                    },
                  ],
              })
            }
          >
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}
