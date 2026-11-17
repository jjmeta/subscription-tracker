import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeIcsText, foldLine, rruleFor } from './ics';
import type { BillingCycle, Subscription } from './types';
import { DEFAULT_SETTINGS } from './types';

const now = new Date('2026-11-17T05:00:00Z');

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'harbour',
    name: 'Harbour Stream',
    amount: 16.99,
    currency: 'AUD',
    cycle: { kind: 'monthly' },
    anchorDate: '2026-11-18',
    nextRenewal: '2026-11-18',
    category: 'Entertainment',
    paymentMethod: 'Apple Pay',
    notes: '',
    status: 'active',
    reminderLeadDays: null,
    sample: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ics generation', () => {
  it('maps each billing cycle to an RRULE', () => {
    const cases: [BillingCycle, string][] = [
      [{ kind: 'weekly' }, 'FREQ=WEEKLY'],
      [{ kind: 'monthly' }, 'FREQ=MONTHLY'],
      [{ kind: 'quarterly' }, 'FREQ=MONTHLY;INTERVAL=3'],
      [{ kind: 'yearly' }, 'FREQ=YEARLY'],
      [{ kind: 'custom', every: 10, unit: 'days' }, 'FREQ=DAILY;INTERVAL=10'],
      [{ kind: 'custom', every: 1, unit: 'days' }, 'FREQ=DAILY'],
      [{ kind: 'custom', every: 2, unit: 'weeks' }, 'FREQ=WEEKLY;INTERVAL=2'],
      [{ kind: 'custom', every: 6, unit: 'months' }, 'FREQ=MONTHLY;INTERVAL=6'],
    ];
    for (const [cycle, rule] of cases) expect(rruleFor(cycle)).toBe(rule);
  });

  it('builds a Brisbane calendar with a lead-time alarm', () => {
    const ics = buildCalendar([sub()], { now, settings: DEFAULT_SETTINGS });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('TZID:Australia/Brisbane');
    expect(ics).toContain('TZOFFSETFROM:+1000');
    expect(ics).toContain('DTSTART;TZID=Australia/Brisbane:20261118T090000');
    expect(ics).toContain('RRULE:FREQ=MONTHLY');
    expect(ics).toContain('TRIGGER:-P3D');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('\r\nTRIGGER:-P3D\r\n');
  });

  it('uses a per-subscription lead, including no advance warning', () => {
    const overridden = buildCalendar([sub({ reminderLeadDays: 1 })], { now, settings: DEFAULT_SETTINGS });
    expect(overridden).toContain('TRIGGER:-P1D');
    expect(overridden).not.toContain('TRIGGER:-P3D');
    const sameDay = buildCalendar([sub({ reminderLeadDays: 0 })], {
      now,
      settings: { ...DEFAULT_SETTINGS, defaultLeadDays: 5 },
    });
    expect(sameDay).toContain('TRIGGER:PT0S');
  });

  it('escapes punctuation, folds long lines, and keeps characters intact', () => {
    expect(escapeIcsText('A, B; C\\D\nE')).toBe('A\\, B\\; C\\\\D\\nE');
    const folded = foldLine(`SUMMARY:${'N'.repeat(70)}é more`);
    expect(folded).toContain('\r\n ');
    expect(folded).toContain('é');
    const ics = buildCalendar([sub({ name: 'Cloud, Plus', notes: 'Line one\nLine two' })], {
      now,
      settings: DEFAULT_SETTINGS,
    });
    expect(ics).toContain('SUMMARY:Cloud\\, Plus renews');
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('Line one\\nLine two');
  });

  it('exports every active subscription once and skips cancelled ones', () => {
    const ics = buildCalendar(
      [
        sub({ id: 'a', name: 'Alpha' }),
        sub({ id: 'b', name: 'Beta', cycle: { kind: 'weekly' }, nextRenewal: '2026-11-20' }),
        sub({ id: 'c', name: 'Gone', status: 'cancelled' }),
      ],
      { now, settings: DEFAULT_SETTINGS, urlFor: (id) => `https://example.com/#/sub/${id}` },
    );
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('UID:a@subscription-tracker');
    expect(ics).toContain('UID:b@subscription-tracker');
    expect(ics).not.toContain('UID:c@subscription-tracker');
    expect(ics).toContain('RRULE:FREQ=WEEKLY');
    expect(ics).toContain('URL:https://example.com/#/sub/a');
  });
});
