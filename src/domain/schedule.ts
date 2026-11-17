import { addDays, addMonths, compareYMD, daysBetween, formatYMD, parseYMD } from './dates';
import type { BillingCycle, Settings, Subscription } from './types';
import { UPCOMING_WINDOW_DAYS } from './types';

function dayInterval(cycle: BillingCycle): number | null {
  if (cycle.kind === 'weekly') return 7;
  if (cycle.kind === 'custom' && cycle.unit === 'days') return cycle.every;
  if (cycle.kind === 'custom' && cycle.unit === 'weeks') return cycle.every * 7;
  return null;
}

function monthInterval(cycle: BillingCycle): number | null {
  if (cycle.kind === 'monthly') return 1;
  if (cycle.kind === 'quarterly') return 3;
  if (cycle.kind === 'yearly') return 12;
  if (cycle.kind === 'custom' && cycle.unit === 'months') return cycle.every;
  return null;
}

export function isMonthBased(cycle: BillingCycle): boolean {
  return monthInterval(cycle) !== null;
}

function assertStep(interval: number): number {
  if (!Number.isInteger(interval) || interval < 1) throw new Error('Invalid billing interval');
  return interval;
}

export function nextOccurrence(anchorISO: string, cycle: BillingCycle, todayISO: string): string {
  const anchor = parseYMD(anchorISO);
  const today = parseYMD(todayISO);
  if (!anchor || !today) throw new Error('Invalid renewal date');
  if (compareYMD(anchor, today) >= 0) return formatYMD(anchor);

  const days = dayInterval(cycle);
  if (days !== null) {
    const interval = assertStep(days);
    const diff = daysBetween(anchor, today);
    const steps = Math.ceil(diff / interval);
    return formatYMD(addDays(anchor, steps * interval));
  }

  const months = monthInterval(cycle);
  if (months === null) throw new Error('Invalid billing cycle');
  const interval = assertStep(months);
  let hi = 1;
  while (compareYMD(addMonths(anchor, hi * interval, anchor.day), today) < 0) {
    if (hi > 100_000) throw new Error('Renewal is too far in the past');
    hi *= 2;
  }
  let lo = 0;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (compareYMD(addMonths(anchor, mid * interval, anchor.day), today) < 0) lo = mid;
    else hi = mid;
  }
  return formatYMD(addMonths(anchor, hi * interval, anchor.day));
}

export function occurrenceAfter(anchorISO: string, cycle: BillingCycle, currentISO: string): string {
  const current = parseYMD(currentISO);
  if (!current) throw new Error('Invalid renewal date');
  const nextDay = formatYMD(addDays(current, 1));
  return nextOccurrence(anchorISO, cycle, nextDay);
}

export function occurrencesBetween(anchorISO: string, cycle: BillingCycle, todayISO: string, windowDays: number): string[] {
  const today = parseYMD(todayISO);
  if (!today) throw new Error('Invalid date');
  const end = addDays(today, windowDays);
  const dates: string[] = [];
  let cursor = nextOccurrence(anchorISO, cycle, todayISO);
  for (let guard = 0; guard < 400; guard += 1) {
    const parsed = parseYMD(cursor);
    if (!parsed || compareYMD(parsed, end) > 0) break;
    dates.push(cursor);
    const next = occurrenceAfter(anchorISO, cycle, cursor);
    if (next <= cursor) break;
    cursor = next;
  }
  return dates;
}

export function materialize(sub: Subscription, today: string): Subscription {
  const nextRenewal = nextOccurrence(sub.anchorDate, sub.cycle, today);
  if (nextRenewal === sub.nextRenewal) return sub;
  return { ...sub, nextRenewal };
}

export function describeCycle(cycle: BillingCycle): string {
  switch (cycle.kind) {
    case 'weekly':
      return 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'quarterly':
      return 'Quarterly';
    case 'yearly':
      return 'Yearly';
    case 'custom':
      if (cycle.every === 1) {
        if (cycle.unit === 'days') return 'Every day';
        if (cycle.unit === 'weeks') return 'Every week';
        return 'Every month';
      }
      return `Every ${cycle.every} ${cycle.unit}`;
  }
}

export function effectiveLead(sub: Pick<Subscription, 'reminderLeadDays'>, settings: Settings): number {
  return sub.reminderLeadDays ?? settings.defaultLeadDays;
}

export type Reminder = {
  subscriptionId: string;
  name: string;
  date: string;
  days: number;
  amount: number;
  currency: string;
};

export function reminders(subs: Subscription[], settings: Settings, today: string): Reminder[] {
  const todayDate = parseYMD(today);
  if (!todayDate) return [];
  const items: Reminder[] = [];
  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    const renewal = parseYMD(sub.nextRenewal);
    if (!renewal) continue;
    const days = daysBetween(todayDate, renewal);
    const lead = effectiveLead(sub, settings);
    if (days < 0 || days > lead) continue;
    items.push({
      subscriptionId: sub.id,
      name: sub.name,
      date: sub.nextRenewal,
      days,
      amount: sub.amount,
      currency: sub.currency,
    });
  }
  items.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name, 'en-AU'));
  return items;
}

export type UpcomingCharge = {
  subscriptionId: string;
  name: string;
  date: string;
  amount: number;
  currency: string;
  category: string;
  dueSoon: boolean;
};

export function upcomingCharges(
  subs: Subscription[],
  settings: Settings,
  today: string,
  windowDays = UPCOMING_WINDOW_DAYS,
): UpcomingCharge[] {
  const todayDate = parseYMD(today);
  if (!todayDate) return [];
  const charges: UpcomingCharge[] = [];
  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    const lead = effectiveLead(sub, settings);
    for (const date of occurrencesBetween(sub.anchorDate, sub.cycle, today, windowDays)) {
      const parsed = parseYMD(date);
      if (!parsed) continue;
      const days = daysBetween(todayDate, parsed);
      charges.push({
        subscriptionId: sub.id,
        name: sub.name,
        date,
        amount: sub.amount,
        currency: sub.currency,
        category: sub.category,
        dueSoon: days <= lead,
      });
    }
  }
  charges.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'en-AU'));
  return charges;
}

export function billingDayNote(cycle: BillingCycle, anchorDate: string): string | null {
  if (!isMonthBased(cycle)) return null;
  const day = parseYMD(anchorDate)?.day;
  if (!day || day < 29) return null;
  return `Billing day ${day}, or the last day of a shorter month`;
}
