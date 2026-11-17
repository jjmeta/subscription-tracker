import { parseYMD } from './dates';
import type { BackupData, BillingCycle, CycleUnit, Settings, Subscription, SubscriptionStatus } from './types';
import { BACKUP_FORMAT, BACKUP_VERSION, DEFAULT_LEAD_DAYS } from './types';

const MAX_SUBSCRIPTIONS = 300;
const ID_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export type BackupResult = { ok: true; data: BackupData } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function push(errors: string[], message: string): void {
  if (errors.length < 20) errors.push(message);
}

function parseCycle(value: unknown, errors: string[], label: string): BillingCycle | null {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    push(errors, `${label}: billing cycle is missing.`);
    return null;
  }
  if (value.kind === 'weekly' || value.kind === 'monthly' || value.kind === 'quarterly' || value.kind === 'yearly') {
    return { kind: value.kind };
  }
  if (value.kind !== 'custom') {
    push(errors, `${label}: billing cycle “${value.kind}” is not supported.`);
    return null;
  }
  const every = value.every;
  const unit = value.unit;
  const units: CycleUnit[] = ['days', 'weeks', 'months'];
  if (!units.includes(unit as CycleUnit)) {
    push(errors, `${label}: custom cycle needs a unit of days, weeks, or months.`);
    return null;
  }
  const max = unit === 'days' ? 3650 : unit === 'weeks' ? 520 : 240;
  if (typeof every !== 'number' || !Number.isInteger(every) || every < 1 || every > max) {
    push(errors, `${label}: custom interval must be a whole number from 1 to ${max}.`);
    return null;
  }
  return { kind: 'custom', every, unit: unit as CycleUnit };
}

function parseStatus(value: unknown, errors: string[], label: string): SubscriptionStatus | null {
  if (value === 'active' || value === 'cancelled') return value;
  push(errors, `${label}: status must be active or cancelled.`);
  return null;
}

function parseSubscription(value: unknown, index: number, errors: string[], now: string): Subscription | null {
  const started = errors.length;
  const label = `Subscription ${index + 1}`;
  if (!isRecord(value)) {
    push(errors, `${label} is not an object.`);
    return null;
  }
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || name.length > 80) push(errors, `${label}: name is required (80 characters max).`);
  if (typeof value.id !== 'string' || !ID_PATTERN.test(value.id)) {
    push(errors, `${label}: id must be 1–80 letters, numbers, dots, colons, underscores, or hyphens.`);
  }
  if (typeof value.amount !== 'number' || !Number.isFinite(value.amount) || value.amount <= 0 || value.amount > 1_000_000) {
    push(errors, `${label}: amount must be greater than 0.`);
  }
  const currency = typeof value.currency === 'string' ? value.currency.trim().toUpperCase() : '';
  if (!CURRENCY_PATTERN.test(currency)) push(errors, `${label}: currency must be a 3-letter code.`);
  const cycle = parseCycle(value.cycle, errors, name || label);
  const nextRenewal = typeof value.nextRenewal === 'string' ? value.nextRenewal : '';
  const anchorRaw = typeof value.anchorDate === 'string' ? value.anchorDate : nextRenewal;
  if (!parseYMD(anchorRaw)) push(errors, `${label}: renewal date must be YYYY-MM-DD.`);
  if (nextRenewal && !parseYMD(nextRenewal)) push(errors, `${label}: next renewal must be YYYY-MM-DD.`);
  const category = typeof value.category === 'string' ? value.category.trim() : '';
  if (!category || category.length > 40) push(errors, `${label}: category is required (40 characters max).`);
  const paymentMethod = typeof value.paymentMethod === 'string' ? value.paymentMethod.trim() : '';
  if (paymentMethod.length > 40) push(errors, `${label}: payment method is too long.`);
  const notes = typeof value.notes === 'string' ? value.notes : '';
  if (notes.length > 2000) push(errors, `${label}: notes are too long.`);
  const status = parseStatus(value.status, errors, name || label);
  let reminderLeadDays: number | null = null;
  if (value.reminderLeadDays != null) {
    if (
      typeof value.reminderLeadDays !== 'number' ||
      !Number.isInteger(value.reminderLeadDays) ||
      value.reminderLeadDays < 0 ||
      value.reminderLeadDays > 90
    ) {
      push(errors, `${label}: reminder days must be a whole number from 0 to 90.`);
    } else {
      reminderLeadDays = value.reminderLeadDays;
    }
  }
  if (errors.length > started || !cycle || !status || typeof value.amount !== 'number' || typeof value.id !== 'string') {
    return null;
  }
  const stamp = (raw: unknown) => (typeof raw === 'string' && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toISOString() : now);
  return {
    id: value.id,
    name,
    amount: Math.round(value.amount * 100) / 100,
    currency,
    cycle,
    anchorDate: anchorRaw,
    nextRenewal: parseYMD(nextRenewal) ? nextRenewal : anchorRaw,
    category,
    paymentMethod,
    notes,
    status,
    reminderLeadDays,
    sample: value.sample === true,
    createdAt: stamp(value.createdAt),
    updatedAt: stamp(value.updatedAt),
  };
}

function parseSettings(value: unknown, errors: string[]): Settings | null {
  if (!isRecord(value)) {
    push(errors, 'Settings are missing.');
    return null;
  }
  const lead = value.defaultLeadDays;
  if (typeof lead !== 'number' || !Number.isInteger(lead) || lead < 0 || lead > 90) {
    push(errors, 'Default reminder days must be a whole number from 0 to 90.');
  }
  const rates: Record<string, number> = {};
  if (!isRecord(value.exchangeRates)) {
    push(errors, 'Exchange rates must be an object.');
  } else {
    for (const [code, rate] of Object.entries(value.exchangeRates)) {
      if (code === 'AUD') continue;
      if (!CURRENCY_PATTERN.test(code)) {
        push(errors, `Exchange rate “${code}” is not a currency code.`);
        continue;
      }
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) {
        push(errors, `Exchange rate for ${code} must be greater than 0.`);
        continue;
      }
      rates[code] = rate;
    }
  }
  if (errors.length) return null;
  return { defaultLeadDays: lead as number, exchangeRates: rates };
}

export function validateBackup(value: unknown, now = new Date().toISOString()): BackupResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['That file is not a subscription backup.'] };
  if (value.format !== BACKUP_FORMAT) push(errors, 'This file is not a subscription-tracker backup.');
  if (value.version !== BACKUP_VERSION) push(errors, `Backup version ${String(value.version)} is not supported.`);
  if (!Array.isArray(value.subscriptions)) {
    push(errors, 'Subscriptions must be a list.');
    return { ok: false, errors };
  }
  if (value.subscriptions.length > MAX_SUBSCRIPTIONS) {
    push(errors, `A backup can hold up to ${MAX_SUBSCRIPTIONS} subscriptions.`);
  }
  const subscriptions: Subscription[] = [];
  const seen = new Set<string>();
  value.subscriptions.forEach((item, index) => {
    const before = errors.length;
    const sub = parseSubscription(item, index, errors, now);
    if (!sub || errors.length > before) return;
    if (seen.has(sub.id)) {
      push(errors, `Duplicate id “${sub.id}”.`);
      return;
    }
    seen.add(sub.id);
    subscriptions.push(sub);
  });
  const settings = parseSettings(value.settings, errors);
  if (!settings || errors.length) return { ok: false, errors };
  const exportedAt = typeof value.exportedAt === 'string' && !Number.isNaN(Date.parse(value.exportedAt)) ? new Date(value.exportedAt).toISOString() : now;
  return { ok: true, data: { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, subscriptions, settings } };
}

export function parseBackupText(text: string, now = new Date().toISOString()): BackupResult {
  if (text.length > 2_000_000) return { ok: false, errors: ['That file is too large.'] };
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return { ok: false, errors: ['That file is not valid JSON.'] };
  }
  return validateBackup(json, now);
}

export function serializeBackup(data: BackupData): string {
  const rates = Object.fromEntries(Object.entries(data.settings.exchangeRates).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({ ...data, settings: { ...data.settings, exchangeRates: rates } }, null, 2)}\n`;
}

export function mergeSubscriptions(existing: Subscription[], incoming: Subscription[]): Subscription[] {
  const map = new Map(existing.map((sub) => [sub.id, sub]));
  for (const sub of incoming) map.set(sub.id, sub);
  return [...map.values()];
}

export function mergeSettings(existing: Settings, incoming: Settings): Settings {
  return {
    defaultLeadDays: incoming.defaultLeadDays ?? DEFAULT_LEAD_DAYS,
    exchangeRates: { ...existing.exchangeRates, ...incoming.exchangeRates },
  };
}
