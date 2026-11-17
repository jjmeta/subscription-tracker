import { describe, expect, it } from 'vitest';
import { mergeSettings, mergeSubscriptions, parseBackupText, serializeBackup } from './backup';
import { subscriptionFromDraft } from './draft';
import type { BackupData, Subscription } from './types';
import { DEFAULT_SETTINGS } from './types';

const now = '2026-11-17T00:00:00.000Z';

function sub(id: string, name = id): Subscription {
  return {
    id,
    name,
    amount: 5,
    currency: 'AUD',
    cycle: { kind: 'monthly' },
    anchorDate: '2026-12-01',
    nextRenewal: '2026-12-01',
    category: 'General',
    paymentMethod: '',
    notes: '',
    status: 'active',
    reminderLeadDays: null,
    sample: false,
    createdAt: now,
    updatedAt: now,
  };
}

function backup(subscriptions: Subscription[], extra: Record<string, unknown> = {}): string {
  const data: BackupData = {
    format: 'subscription-tracker',
    version: 1,
    exportedAt: now,
    subscriptions,
    settings: { defaultLeadDays: 3, exchangeRates: { USD: 1.5 } },
  };
  return JSON.stringify({ ...data, ...extra });
}

describe('backup import', () => {
  it('round-trips a valid file and fills a missing anchor from the renewal date', () => {
    const raw = JSON.parse(backup([sub('one', 'Harbour')])) as { subscriptions: { anchorDate?: string }[] };
    delete raw.subscriptions[0]?.anchorDate;
    const parsed = parseBackupText(JSON.stringify(raw), now);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.subscriptions[0]?.anchorDate).toBe('2026-12-01');
    const again = parseBackupText(serializeBackup(parsed.data), now);
    expect(again.ok).toBe(true);
  });

  it('rejects bad amounts, dates, cycles, and duplicate ids', () => {
    const badAmount = parseBackupText(backup([{ ...sub('one'), amount: 0 }]), now);
    expect(badAmount.ok).toBe(false);
    const badDate = parseBackupText(backup([{ ...sub('one'), nextRenewal: '2026-02-31', anchorDate: '2026-02-31' }]), now);
    expect(badDate.ok).toBe(false);
    const badCycle = parseBackupText(backup([{ ...sub('one'), cycle: { kind: 'custom', every: 0, unit: 'days' } }]), now);
    expect(badCycle.ok).toBe(false);
    const duplicate = parseBackupText(backup([sub('one'), sub('one', 'Other')]), now);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.errors.some((error) => error.includes('Duplicate'))).toBe(true);
    expect(parseBackupText('{', now).ok).toBe(false);
    expect(parseBackupText(JSON.stringify({ format: 'other', version: 1, subscriptions: [], settings: DEFAULT_SETTINGS }), now).ok).toBe(false);
  });

  it('merges by id and replaces settings rates without dropping local ones', () => {
    const merged = mergeSubscriptions([sub('keep', 'Keep'), sub('same', 'Old')], [sub('same', 'New'), sub('added', 'Added')]);
    expect(merged.map((item) => item.name)).toEqual(['Keep', 'New', 'Added']);
    const settings = mergeSettings(
      { defaultLeadDays: 3, exchangeRates: { USD: 1.4, EUR: 1.6 } },
      { defaultLeadDays: 5, exchangeRates: { USD: 1.55 } },
    );
    expect(settings).toEqual({ defaultLeadDays: 5, exchangeRates: { USD: 1.55, EUR: 1.6 } });
  });
});

describe('subscription drafts', () => {
  const base = {
    id: 'sub',
    name: 'Harbour Stream',
    amount: '16.99',
    currency: 'aud',
    cycleKind: 'monthly' as const,
    every: '1',
    unit: 'months' as const,
    category: 'Entertainment',
    paymentMethod: 'Card',
    notes: '',
    status: 'active' as const,
    useDefaultLead: true,
    leadDays: '3',
    createdAt: now,
  };

  it('keeps the anchor day when the shown renewal date is unchanged', () => {
    const result = subscriptionFromDraft(
      {
        ...base,
        renewalDate: '2026-03-31',
        existingAnchorDate: '2026-01-31',
        existingNextRenewal: '2026-03-31',
      },
      '2026-03-01',
      now,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.subscription.anchorDate).toBe('2026-01-31');
    expect(result.subscription.nextRenewal).toBe('2026-03-31');
    expect(result.subscription.currency).toBe('AUD');
  });

  it('rolls a new past date forward and replaces the anchor when the date changes', () => {
    const created = subscriptionFromDraft(
      { ...base, renewalDate: '2026-01-31', existingAnchorDate: null, existingNextRenewal: null },
      '2026-03-01',
      now,
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.subscription.anchorDate).toBe('2026-01-31');
    expect(created.subscription.nextRenewal).toBe('2026-03-31');

    const moved = subscriptionFromDraft(
      {
        ...base,
        renewalDate: '2026-04-15',
        existingAnchorDate: '2026-01-31',
        existingNextRenewal: '2026-03-31',
      },
      '2026-03-01',
      now,
    );
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.subscription.anchorDate).toBe('2026-04-15');
    expect(moved.subscription.nextRenewal).toBe('2026-04-15');
  });
});
