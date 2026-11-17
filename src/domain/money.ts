import { describeCycle } from './schedule';
import type { BillingCycle, Settings, Subscription } from './types';
import { HOME_CURRENCY } from './types';

/** Average year length so a week and a custom 7-day cycle cost the same. */
export const DAYS_PER_YEAR = 365.25;

export function yearlyMultiplier(cycle: BillingCycle): number {
  switch (cycle.kind) {
    case 'weekly':
      return DAYS_PER_YEAR / 7;
    case 'monthly':
      return 12;
    case 'quarterly':
      return 4;
    case 'yearly':
      return 1;
    case 'custom':
      if (cycle.unit === 'days') return DAYS_PER_YEAR / cycle.every;
      if (cycle.unit === 'weeks') return DAYS_PER_YEAR / (cycle.every * 7);
      return 12 / cycle.every;
  }
}

export function yearlyCost(amount: number, cycle: BillingCycle): number {
  return amount * yearlyMultiplier(cycle);
}

export function monthlyCost(amount: number, cycle: BillingCycle): number {
  return yearlyCost(amount, cycle) / 12;
}

export function parseAmount(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, '');
  const normalized = /^\d+,\d{1,2}$/.test(trimmed) ? trimmed.replace(',', '.') : trimmed;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null;
  return Math.round(value * 100) / 100;
}

export function parseRate(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, '');
  const normalized = /^\d+,\d{1,6}$/.test(trimmed) ? trimmed.replace(',', '.') : trimmed;
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 1_000_000) return null;
  return value;
}

export function toAud(amount: number, currency: string, rates: Record<string, number>): number | null {
  if (currency === HOME_CURRENCY) return amount;
  const rate = rates[currency];
  if (rate == null || !(rate > 0) || !Number.isFinite(rate)) return null;
  return amount * rate;
}

export function formatMoney(amount: number, currency: string): string {
  const digits = currency === 'JPY' ? 0 : 2;
  let formatted: string;
  try {
    formatted = new Intl.NumberFormat('en-AU', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    formatted = amount.toFixed(digits);
  }
  if (currency === 'AUD') return `$${formatted}`;
  if (currency === 'EUR') return `€${formatted}`;
  if (currency === 'GBP') return `£${formatted}`;
  if (currency === 'JPY') return `¥${formatted}`;
  return `${currency} ${formatted}`;
}

export type SpendRow = {
  id: string;
  name: string;
  category: string;
  currency: string;
  amount: number;
  cycleLabel: string;
  monthlyAud: number;
};

export type SpendSummary = {
  monthlyAud: number;
  yearlyAud: number;
  byCategory: { category: string; monthlyAud: number; yearlyAud: number }[];
  included: SpendRow[];
  missingRates: { id: string; name: string; currency: string }[];
};

export function summariseSpend(subs: Subscription[], settings: Settings): SpendSummary {
  const included: SpendRow[] = [];
  const missingRates: SpendSummary['missingRates'] = [];
  const categories = new Map<string, { monthlyAud: number; yearlyAud: number }>();

  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    const monthly = monthlyCost(sub.amount, sub.cycle);
    const aud = toAud(monthly, sub.currency, settings.exchangeRates);
    if (aud == null) {
      missingRates.push({ id: sub.id, name: sub.name, currency: sub.currency });
      continue;
    }
    const yearly = aud * 12;
    included.push({
      id: sub.id,
      name: sub.name,
      category: sub.category,
      currency: sub.currency,
      amount: sub.amount,
      cycleLabel: describeCycle(sub.cycle),
      monthlyAud: aud,
    });
    const bucket = categories.get(sub.category) ?? { monthlyAud: 0, yearlyAud: 0 };
    bucket.monthlyAud += aud;
    bucket.yearlyAud += yearly;
    categories.set(sub.category, bucket);
  }

  included.sort((a, b) => b.monthlyAud - a.monthlyAud || a.name.localeCompare(b.name, 'en-AU'));
  const byCategory = [...categories.entries()]
    .map(([category, totals]) => ({ category, ...totals }))
    .sort((a, b) => b.monthlyAud - a.monthlyAud || a.category.localeCompare(b.category, 'en-AU'));

  const monthlyAud = included.reduce((sum, row) => sum + row.monthlyAud, 0);
  return {
    monthlyAud,
    yearlyAud: monthlyAud * 12,
    byCategory,
    included,
    missingRates,
  };
}

export function foreignCurrencies(subs: Subscription[]): string[] {
  return [...new Set(subs.map((sub) => sub.currency).filter((currency) => currency !== HOME_CURRENCY))].sort();
}
