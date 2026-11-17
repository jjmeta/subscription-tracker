import { parseYMD } from './dates';
import { parseAmount } from './money';
import { nextOccurrence } from './schedule';
import type { BillingCycle, CycleUnit, Subscription, SubscriptionStatus } from './types';

export type DraftInput = {
  id: string;
  name: string;
  amount: string;
  currency: string;
  cycleKind: 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
  every: string;
  unit: CycleUnit;
  renewalDate: string;
  existingAnchorDate: string | null;
  existingNextRenewal: string | null;
  category: string;
  paymentMethod: string;
  notes: string;
  status: SubscriptionStatus;
  useDefaultLead: boolean;
  leadDays: string;
  createdAt: string | null;
};

export type DraftResult = { ok: true; subscription: Subscription } | { ok: false; errors: Record<string, string> };

function cycleFromDraft(draft: DraftInput): BillingCycle | null {
  if (draft.cycleKind !== 'custom') return { kind: draft.cycleKind };
  const every = Number(draft.every);
  if (!Number.isInteger(every) || every < 1) return null;
  const max = draft.unit === 'days' ? 3650 : draft.unit === 'weeks' ? 520 : 240;
  if (every > max) return null;
  return { kind: 'custom', every, unit: draft.unit };
}

export function subscriptionFromDraft(draft: DraftInput, today: string, nowIso: string): DraftResult {
  const errors: Record<string, string> = {};
  const name = draft.name.trim();
  if (!name) errors.name = 'Enter a name.';
  else if (name.length > 80) errors.name = 'Use 80 characters or fewer.';

  const amount = parseAmount(draft.amount);
  if (amount == null) errors.amount = 'Enter an amount greater than 0, with up to 2 decimal places.';

  const currency = draft.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = 'Use a 3-letter currency code.';

  const cycle = cycleFromDraft(draft);
  if (!cycle) errors.cycle = 'Enter how often it renews.';

  if (!parseYMD(draft.renewalDate)) errors.renewalDate = 'Choose a valid date.';

  const category = draft.category.trim();
  if (!category) errors.category = 'Choose a category.';
  else if (category.length > 40) errors.category = 'Use 40 characters or fewer.';

  const paymentMethod = draft.paymentMethod.trim();
  if (paymentMethod.length > 40) errors.paymentMethod = 'Use 40 characters or fewer.';

  const notes = draft.notes;
  if (notes.length > 2000) errors.notes = 'Notes are limited to 2000 characters.';

  let reminderLeadDays: number | null = null;
  if (!draft.useDefaultLead) {
    const lead = Number(draft.leadDays);
    if (!Number.isInteger(lead) || lead < 0 || lead > 60) errors.leadDays = 'Use a whole number from 0 to 60.';
    else reminderLeadDays = lead;
  }

  if (Object.keys(errors).length || !cycle || amount == null) return { ok: false, errors };

  const anchorDate =
    draft.existingAnchorDate && draft.existingNextRenewal && draft.renewalDate === draft.existingNextRenewal
      ? draft.existingAnchorDate
      : draft.renewalDate;
  const nextRenewal = nextOccurrence(anchorDate, cycle, today);

  return {
    ok: true,
    subscription: {
      id: draft.id,
      name,
      amount,
      currency,
      cycle,
      anchorDate,
      nextRenewal,
      category,
      paymentMethod,
      notes: notes.trim(),
      status: draft.status,
      reminderLeadDays,
      sample: false,
      createdAt: draft.createdAt ?? nowIso,
      updatedAt: nowIso,
    },
  };
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
