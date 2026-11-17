import { addDays, formatYMD, parseYMD } from './dates';
import { materialize } from './schedule';
import type { BillingCycle, Subscription } from './types';

const NOTE = 'Fictional example for trying the app. Not a real bill.';

function shift(today: string, days: number): string {
  const parsed = parseYMD(today);
  if (!parsed) throw new Error('Invalid date');
  return formatYMD(addDays(parsed, days));
}

function make(
  today: string,
  now: string,
  fields: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    cycle: BillingCycle;
    daysAhead: number;
    category: string;
    paymentMethod: string;
    status?: Subscription['status'];
    reminderLeadDays?: number | null;
    notes?: string;
  },
): Subscription {
  const anchorDate = shift(today, fields.daysAhead);
  return materialize(
    {
      id: fields.id,
      name: fields.name,
      amount: fields.amount,
      currency: fields.currency,
      cycle: fields.cycle,
      anchorDate,
      nextRenewal: anchorDate,
      category: fields.category,
      paymentMethod: fields.paymentMethod,
      notes: fields.notes ?? NOTE,
      status: fields.status ?? 'active',
      reminderLeadDays: fields.reminderLeadDays ?? null,
      sample: true,
      createdAt: now,
      updatedAt: now,
    },
    today,
  );
}

/** Invented subscriptions dated from today. Nothing is stored until the user asks. */
export function buildExamples(today: string, now = new Date().toISOString()): Subscription[] {
  return [
    make(today, now, {
      id: 'example-harbour',
      name: 'Harbour Stream',
      amount: 16.99,
      currency: 'AUD',
      cycle: { kind: 'monthly' },
      daysAhead: 0,
      category: 'Entertainment',
      paymentMethod: 'Apple Pay',
      reminderLeadDays: 1,
      notes: 'Fictional streaming service. Not a real bill.',
    }),
    make(today, now, {
      id: 'example-paperplane',
      name: 'Paperplane Music',
      amount: 11.99,
      currency: 'AUD',
      cycle: { kind: 'monthly' },
      daysAhead: 2,
      category: 'Music',
      paymentMethod: 'Card',
    }),
    make(today, now, {
      id: 'example-wattle',
      name: 'Wattle Weekly',
      amount: 4,
      currency: 'AUD',
      cycle: { kind: 'weekly' },
      daysAhead: 3,
      category: 'News',
      paymentMethod: 'Card',
    }),
    make(today, now, {
      id: 'example-draft',
      name: 'Draft Supply',
      amount: 18,
      currency: 'AUD',
      cycle: { kind: 'custom', every: 14, unit: 'days' },
      daysAhead: 6,
      category: 'Shopping',
      paymentMethod: 'PayPal',
    }),
    make(today, now, {
      id: 'example-lumen',
      name: 'Lumen Cloud',
      amount: 6.5,
      currency: 'AUD',
      cycle: { kind: 'monthly' },
      daysAhead: 12,
      category: 'Cloud',
      paymentMethod: 'Bank account',
    }),
    make(today, now, {
      id: 'example-kinship',
      name: 'Kinship Fitness',
      amount: 39,
      currency: 'AUD',
      cycle: { kind: 'quarterly' },
      daysAhead: 21,
      category: 'Fitness',
      paymentMethod: 'Card',
    }),
    make(today, now, {
      id: 'example-northwind',
      name: 'Northwind VPN',
      amount: 79,
      currency: 'USD',
      cycle: { kind: 'yearly' },
      daysAhead: 45,
      category: 'Software',
      paymentMethod: 'Card',
      notes: 'Fictional VPN billed in US dollars. Enter a manual rate to include it in AUD totals.',
    }),
    make(today, now, {
      id: 'example-parcel',
      name: 'Parcel Club',
      amount: 9,
      currency: 'AUD',
      cycle: { kind: 'monthly' },
      daysAhead: 9,
      category: 'Shopping',
      paymentMethod: 'Card',
      status: 'cancelled',
    }),
  ];
}
