import { describe, expect, it } from 'vitest';
import { nextOccurrence, occurrenceAfter, occurrencesBetween, reminders } from './schedule';
import type { BillingCycle, Subscription } from './types';
import { DEFAULT_SETTINGS } from './types';

const monthly: BillingCycle = { kind: 'monthly' };

function sub(overrides: Partial<Subscription> & Pick<Subscription, 'anchorDate'>): Subscription {
  return {
    id: 'sub',
    name: 'Test',
    amount: 10,
    currency: 'AUD',
    cycle: monthly,
    nextRenewal: overrides.anchorDate,
    category: 'General',
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

describe('renewal roll-forward', () => {
  it('keeps a renewal that is today or still ahead', () => {
    expect(nextOccurrence('2026-11-17', monthly, '2026-11-17')).toBe('2026-11-17');
    expect(nextOccurrence('2026-12-01', monthly, '2026-11-17')).toBe('2026-12-01');
  });

  it('steps weekly intervals onto the next charge, including exact multiples', () => {
    expect(nextOccurrence('2026-11-10', { kind: 'weekly' }, '2026-11-17')).toBe('2026-11-17');
    expect(nextOccurrence('2026-11-10', { kind: 'weekly' }, '2026-11-18')).toBe('2026-11-24');
  });

  it('keeps the 31st and clamps short months', () => {
    expect(nextOccurrence('2025-01-31', monthly, '2025-02-01')).toBe('2025-02-28');
    expect(nextOccurrence('2025-01-31', monthly, '2025-02-28')).toBe('2025-02-28');
    expect(nextOccurrence('2025-01-31', monthly, '2025-03-01')).toBe('2025-03-31');
  });

  it('rolls a leap-day yearly subscription', () => {
    const yearly: BillingCycle = { kind: 'yearly' };
    expect(nextOccurrence('2024-02-29', yearly, '2025-02-28')).toBe('2025-02-28');
    expect(nextOccurrence('2024-02-29', yearly, '2025-03-01')).toBe('2026-02-28');
    expect(nextOccurrence('2024-02-29', yearly, '2028-02-29')).toBe('2028-02-29');
  });

  it('rolls custom day, week, and month cycles', () => {
    expect(nextOccurrence('2026-11-01', { kind: 'custom', every: 10, unit: 'days' }, '2026-11-17')).toBe('2026-11-21');
    expect(nextOccurrence('2026-11-01', { kind: 'custom', every: 2, unit: 'weeks' }, '2026-11-20')).toBe('2026-11-29');
    expect(nextOccurrence('2025-01-31', { kind: 'custom', every: 2, unit: 'months' }, '2025-03-01')).toBe('2025-03-31');
  });

  it('jumps many years of monthly charges without drifting the day', () => {
    expect(nextOccurrence('1976-11-17', monthly, '2026-11-17')).toBe('2026-11-17');
    expect(nextOccurrence('1976-11-17', monthly, '2026-11-18')).toBe('2026-12-17');
  });

  it('walks the next occurrence from the anchor day, not the clamped day', () => {
    const first = nextOccurrence('2025-01-31', monthly, '2025-02-01');
    expect(first).toBe('2025-02-28');
    expect(occurrenceAfter('2025-01-31', monthly, first)).toBe('2025-03-31');
  });

  it('lists each charge in the next 30 days', () => {
    const dates = occurrencesBetween('2026-11-18', { kind: 'weekly' }, '2026-11-17', 30);
    expect(dates).toEqual(['2026-11-18', '2026-11-25', '2026-12-02', '2026-12-09', '2026-12-16']);
  });

  it('uses a per-subscription reminder override', () => {
    const tight = sub({ id: 'a', anchorDate: '2026-11-19', nextRenewal: '2026-11-19', reminderLeadDays: 1 });
    const normal = sub({ id: 'b', anchorDate: '2026-11-19', nextRenewal: '2026-11-19' });
    const cancelled = sub({ id: 'c', anchorDate: '2026-11-17', nextRenewal: '2026-11-17', status: 'cancelled' });
    const items = reminders([tight, normal, cancelled], DEFAULT_SETTINGS, '2026-11-17');
    expect(items.map((item) => item.subscriptionId)).toEqual(['b']);
  });
});
