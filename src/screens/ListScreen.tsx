import { useMemo, useState } from 'react';
import { IconCalendar, IconPlus } from '../components/icons';
import { ScreenHeader } from '../components/ui';
import { formatShortDate, relativeLabel } from '../domain/dates';
import { formatMoney, summariseSpend } from '../domain/money';
import { initials, matchesQuery, partitionSubscriptions } from '../domain/present';
import { describeCycle, reminders } from '../domain/schedule';
import { HOME_CURRENCY } from '../domain/types';
import { navigate } from '../router';
import { useAppState } from '../state/AppState';

export function ListScreen({ onLoadExamples }: { onLoadExamples: () => void }) {
  const { subscriptions, settings, today } = useAppState();
  const [query, setQuery] = useState('');
  const due = useMemo(() => reminders(subscriptions, settings, today), [subscriptions, settings, today]);
  const dueIds = useMemo(() => new Set(due.map((item) => item.subscriptionId)), [due]);
  const summary = useMemo(() => summariseSpend(subscriptions, settings), [subscriptions, settings]);
  const filtered = subscriptions.filter((subscription) => matchesQuery(subscription, query));
  const { active, cancelled } = partitionSubscriptions(filtered);
  const subtitle = subscriptions.length
    ? summary.missingRates.length
      ? `${formatMoney(summary.monthlyAud, HOME_CURRENCY)} this month · excl. ${summary.missingRates.map((item) => item.currency).join(', ')}`
      : `${formatMoney(summary.monthlyAud, HOME_CURRENCY)} this month`
    : 'Nothing tracked yet';

  return (
    <div className="screen">
      <ScreenHeader
        title="Subscriptions"
        subtitle={subtitle}
        action={
          <button type="button" className="icon-btn" aria-label="Add subscription" onClick={() => navigate({ name: 'edit', id: null })}>
            <IconPlus />
          </button>
        }
      />
      {subscriptions.length > 0 ? (
        <div className="search">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="Search subscriptions"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      ) : null}
      {due.length > 0 ? (
        <button type="button" className="banner" onClick={() => navigate({ name: 'upcoming' })}>
          <IconCalendar className="banner-icon" />
          <span>
            <strong>
              {due.length === 1
                ? `${due[0]?.name} renews ${due[0]?.days === 0 ? 'today' : due[0]?.days === 1 ? 'tomorrow' : `in ${due[0]?.days} days`}`
                : `${due.length} renewals coming up`}
            </strong>
            <span>
              {due.length === 1
                ? formatMoney(due[0]?.amount ?? 0, due[0]?.currency ?? HOME_CURRENCY)
                : `Next: ${due[0]?.name} ${due[0]?.days === 0 ? 'today' : due[0]?.days === 1 ? 'tomorrow' : `in ${due[0]?.days} days`}`}
            </span>
          </span>
        </button>
      ) : null}
      {subscriptions.length === 0 ? (
        <div className="empty">
          <img className="mark" src={`${import.meta.env.BASE_URL}apple-touch-icon.png`} alt="" width="76" height="76" />
          <h2>Add what you pay for</h2>
          <p>Renewals stay on this iPhone. Nothing is sent to a server.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate({ name: 'edit', id: null })}>
            Add a subscription
          </button>
          <button type="button" className="btn btn-quiet" onClick={onLoadExamples}>
            Load fictional examples
          </button>
        </div>
      ) : null}
      {active.length > 0 ? (
        <section className="section">
          <h2 className="section-label">Active</h2>
          <div className="group">
            {active.map((subscription) => (
              <button key={subscription.id} type="button" className="sub-row" onClick={() => navigate({ name: 'detail', id: subscription.id })}>
                <span className="avatar">{initials(subscription.name)}</span>
                <span className="sub-copy">
                  <strong>{subscription.name}</strong>
                  <small className={dueIds.has(subscription.id) ? 'due' : undefined}>
                    {relativeLabel(today, subscription.nextRenewal)} · {describeCycle(subscription.cycle)}
                  </small>
                </span>
                <span className="sub-amount">
                  {formatMoney(subscription.amount, subscription.currency)}
                  <small>{formatShortDate(subscription.nextRenewal)}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {query && active.length === 0 && cancelled.length === 0 && subscriptions.length > 0 ? <p className="section-foot">No matches.</p> : null}
      {cancelled.length > 0 ? (
        <section className="section">
          <h2 className="section-label">Cancelled</h2>
          <div className="group">
            {cancelled.map((subscription) => (
              <button
                key={subscription.id}
                type="button"
                className="sub-row cancelled-row"
                onClick={() => navigate({ name: 'detail', id: subscription.id })}
              >
                <span className="avatar">{initials(subscription.name)}</span>
                <span className="sub-copy">
                  <strong>{subscription.name}</strong>
                  <small>Cancelled · {subscription.category}</small>
                </span>
                <span className="sub-amount">{formatMoney(subscription.amount, subscription.currency)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
