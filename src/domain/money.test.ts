import { describe, expect, it } from 'vitest';
import { formatMoney, monthlyCost, parseAmount, parseRate, summariseSpend, yearlyCost } from './money';
import { DAYS_PER_YEAR } from './money';
import type { BillingCycle, Subscription } from './types';
import { DEFAULT_SETTINGS } from './types';

const monthly: BillingCycle = { kind: 'monthly' };

function sub(overrides: Partial<Subscription>): Subscription {
  return {
    id: 'sub',
    name: 'Test',
    amount: 10,
    currency: 'AUD',
    cycle: monthly,
    anchorDate: '2026-11-17',
    nextRenewal: '2026-11-17',
    category: 'Music',
    paymentMethod: '',
    notes: '',
    status: 'active',
    reminderLeadDays: null,
    sample: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('cycle normalisation', () => {
  it('turns monthly, quarterly, and yearly into exact annual multiples', () => {
    expect(monthlyCost(10, monthly)).toBe(10);
    expect(yearlyCost(10, monthly)).toBe(120);
    expect(yearlyCost(30, { kind: 'quarterly' })).toBe(120);
    expect(monthlyCost(30, { kind: 'quarterly' })).toBe(10);
    expect(yearlyCost(120, { kind: 'yearly' })).toBe(120);
    expect(monthlyCost(120, { kind: 'yearly' })).toBe(10);
  });

  it('treats a week and a custom 7-day cycle as the same cost', () => {
    const weekly = yearlyCost(10, { kind: 'weekly' });
    const sevenDays = yearlyCost(10, { kind: 'custom', every: 7, unit: 'days' });
    const oneWeek = yearlyCost(10, { kind: 'custom', every: 1, unit: 'weeks' });
    expect(weekly).toBeCloseTo((10 * DAYS_PER_YEAR) / 7, 10);
    expect(sevenDays).toBe(weekly);
    expect(oneWeek).toBe(weekly);
    expect(yearlyCost(10, { kind: 'custom', every: 2, unit: 'weeks' })).toBe(weekly / 2);
    expect(yearlyCost(10, { kind: 'custom', every: 2, unit: 'months' })).toBe(60);
    expect(yearlyCost(10, { kind: 'custom', every: 10, unit: 'days' })).toBeCloseTo((10 * DAYS_PER_YEAR) / 10, 10);
  });

  it('converts foreign amounts with a manual rate and skips a missing one', () => {
    const summary = summariseSpend(
      [
        sub({ id: 'music', amount: 10, category: 'Music' }),
        sub({ id: 'news', amount: 120, cycle: { kind: 'yearly' }, category: 'News' }),
        sub({ id: 'vpn', amount: 10, currency: 'USD', category: 'Software' }),
        sub({ id: 'old', amount: 50, status: 'cancelled', category: 'Music' }),
      ],
      { ...DEFAULT_SETTINGS, exchangeRates: { USD: 1.5 } },
    );
    expect(summary.monthlyAud).toBe(35);
    expect(summary.yearlyAud).toBe(420);
    expect(summary.byCategory.map((row) => [row.category, row.monthlyAud])).toEqual([
      ['Software', 15],
      ['Music', 10],
      ['News', 10],
    ]);
    expect(summary.missingRates).toEqual([]);

    const missing = summariseSpend(
      [sub({ id: 'vpn', currency: 'USD', amount: 10 }), sub({ amount: 10 })],
      DEFAULT_SETTINGS,
    );
    expect(missing.monthlyAud).toBe(10);
    expect(missing.missingRates.map((row) => row.currency)).toEqual(['USD']);
  });

  it('parses amounts, rates, and unambiguous currency text', () => {
    expect(parseAmount('16.99')).toBe(16.99);
    expect(parseAmount('10,50')).toBe(10.5);
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('10.999')).toBeNull();
    expect(parseRate('1,5234')).toBe(1.5234);
    expect(parseRate('0')).toBeNull();
    expect(formatMoney(16.9, 'AUD')).toBe('$16.90');
    expect(formatMoney(79, 'USD')).toBe('USD 79.00');
    expect(formatMoney(1000, 'JPY')).toBe('¥1,000');
  });
});
