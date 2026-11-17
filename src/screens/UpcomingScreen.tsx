import { useMemo } from 'react';
import { ScreenHeader } from '../components/ui';
import { formatLongDate, relativeLabel } from '../domain/dates';
import { formatMoney } from '../domain/money';
import { reminders, upcomingCharges } from '../domain/schedule';
import { UPCOMING_WINDOW_DAYS } from '../domain/types';
import { navigate } from '../router';
import { useAppState } from '../state/AppState';

export function UpcomingScreen({ onCalendar }: { onCalendar: () => void }) {
  const { subscriptions, settings, today } = useAppState();
  const charges = useMemo(() => upcomingCharges(subscriptions, settings, today), [subscriptions, settings, today]);
  const due = reminders(subscriptions, settings, today);
  const active = subscriptions.some((subscription) => subscription.status === 'active');
  let previousDate = '';

  return (
    <div className="screen">
      <ScreenHeader title="Upcoming" subtitle={`Next ${UPCOMING_WINDOW_DAYS} days · Australia/Brisbane`} />
      {due.length > 0 ? (
        <div className="banner static">
          <span>
            <strong>{due.length === 1 ? '1 reminder is due' : `${due.length} reminders are due`}</strong>
            <span>Calendar alerts fire even when this app is closed. Push notifications need a server, so they are not used.</span>
          </span>
        </div>
      ) : null}
      {charges.length === 0 ? (
        <div className="empty">
          <h2>{active ? 'Nothing due in the next 30 days' : 'No renewals yet'}</h2>
          <p>{active ? 'Later charges still count in Spend.' : 'Add a subscription and its renewals will show up here.'}</p>
        </div>
      ) : (
        <div className="group upcoming-list">
          {charges.map((charge) => {
            const showDate = charge.date !== previousDate;
            previousDate = charge.date;
            return (
              <div key={`${charge.subscriptionId}-${charge.date}`}>
                {showDate ? (
                  <h2 className="date-head">
                    {relativeLabel(today, charge.date)}
                    <span>{formatLongDate(charge.date)}</span>
                  </h2>
                ) : null}
                <button type="button" className="sub-row" onClick={() => navigate({ name: 'detail', id: charge.subscriptionId })}>
                  <span className="sub-copy">
                    <strong>{charge.name}</strong>
                    <small className={charge.dueSoon ? 'due' : undefined}>
                      {charge.category}
                      {charge.dueSoon ? ' · Reminder' : ''}
                    </small>
                  </span>
                  <span className="sub-amount">{formatMoney(charge.amount, charge.currency)}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={onCalendar} disabled={!active}>
        Add all to Calendar
      </button>
      <p className="section-foot">
        One calendar file covers every active subscription. Each event repeats with its billing cycle and alerts you at 9:00am Brisbane, using that subscription’s reminder window.
      </p>
    </div>
  );
}
