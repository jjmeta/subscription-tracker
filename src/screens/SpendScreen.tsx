import { useMemo } from 'react';
import { ScreenHeader } from '../components/ui';
import { formatMoney } from '../domain/money';
import { summariseSpend } from '../domain/money';
import { HOME_CURRENCY } from '../domain/types';
import { navigate } from '../router';
import { useAppState } from '../state/AppState';

export function SpendScreen() {
  const { subscriptions, settings } = useAppState();
  const summary = useMemo(() => summariseSpend(subscriptions, settings), [subscriptions, settings]);
  const max = summary.byCategory[0]?.monthlyAud ?? 0;
  const hasActive = subscriptions.some((subscription) => subscription.status === 'active');

  return (
    <div className="screen">
      <ScreenHeader title="Spend" subtitle="Active subscriptions, averaged into a month and a year" />
      {!hasActive ? (
        <div className="empty">
          <h2>No active totals</h2>
          <p>Cancelled subscriptions are left out. Add one, or reactivate one, to see the spend.</p>
        </div>
      ) : (
        <>
          <div className="stat">
            <b>{formatMoney(summary.monthlyAud, HOME_CURRENCY)}</b>
            <span>per month</span>
            <em>{formatMoney(summary.yearlyAud, HOME_CURRENCY)} per year</em>
          </div>
          {summary.missingRates.length > 0 ? (
            <button type="button" className="callout" onClick={() => navigate({ name: 'settings' })}>
              Totals skip {summary.missingRates.map((item) => item.currency).join(', ')} until you enter an exchange rate.
            </button>
          ) : null}
          {summary.byCategory.length > 0 ? (
            <section className="section">
              <h2 className="section-label">By category</h2>
              <div className="group">
                {summary.byCategory.map((row) => (
                  <div key={row.category} className="bar-row">
                    <header>
                      <span>{row.category}</span>
                      <span>{formatMoney(row.monthlyAud, HOME_CURRENCY)}</span>
                    </header>
                    <div className="track">
                      <span style={{ width: max > 0 ? `${Math.max(6, (row.monthlyAud / max) * 100)}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section className="section">
            <h2 className="section-label">Each subscription</h2>
            <div className="group">
              {summary.included.map((row) => (
                <button key={row.id} type="button" className="sub-row" onClick={() => navigate({ name: 'detail', id: row.id })}>
                  <span className="sub-copy">
                    <strong>{row.name}</strong>
                    <small>
                      {formatMoney(row.amount, row.currency)} · {row.cycleLabel}
                    </small>
                  </span>
                  <span className="sub-amount">
                    {formatMoney(row.monthlyAud, HOME_CURRENCY)}
                    <small>/ month</small>
                  </span>
                </button>
              ))}
              {summary.missingRates.map((row) => (
                <button key={row.id} type="button" className="sub-row" onClick={() => navigate({ name: 'settings' })}>
                  <span className="sub-copy">
                    <strong>{row.name}</strong>
                    <small className="due">Set a {row.currency} rate</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="section-foot">
              Monthly, quarterly, and yearly prices use 12, 4, and 1 charges a year. Weekly and custom day counts use a 365.25-day year, so a week matches a 7-day cycle. Amounts in other currencies stay in that currency everywhere except these AUD totals.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
