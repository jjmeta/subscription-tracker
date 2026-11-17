export const HOME_CURRENCY = 'AUD';
export const DEFAULT_LEAD_DAYS = 3;
export const UPCOMING_WINDOW_DAYS = 30;
export const BACKUP_FORMAT = 'subscription-tracker' as const;
export const BACKUP_VERSION = 1 as const;
export const TIME_ZONE = 'Australia/Brisbane';

export const CATEGORIES = [
  'General',
  'Entertainment',
  'Music',
  'Video',
  'Software',
  'Cloud',
  'News',
  'Health',
  'Fitness',
  'Utilities',
  'Finance',
  'Education',
  'Food',
  'Shopping',
  'Other',
] as const;

export const CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'CAD', 'JPY', 'SGD', 'CHF', 'HKD'] as const;

export type CycleUnit = 'days' | 'weeks' | 'months';

export type BillingCycle =
  | { kind: 'weekly' }
  | { kind: 'monthly' }
  | { kind: 'quarterly' }
  | { kind: 'yearly' }
  | { kind: 'custom'; every: number; unit: CycleUnit };

export type SubscriptionStatus = 'active' | 'cancelled';

export type Subscription = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cycle: BillingCycle;
  /** Schedule origin. Month-based cycles keep this day-of-month, clamped in short months. */
  anchorDate: string;
  /** Next charge on or after today. Derived from anchorDate. */
  nextRenewal: string;
  category: string;
  paymentMethod: string;
  notes: string;
  status: SubscriptionStatus;
  /** Null uses the global default reminder. */
  reminderLeadDays: number | null;
  /** Invented rows from “Load fictional examples”. Never the default data. */
  sample: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  defaultLeadDays: number;
  /** How many AUD equal 1 unit of the foreign currency. AUD itself is always 1. */
  exchangeRates: Record<string, number>;
};

export const DEFAULT_SETTINGS: Settings = {
  defaultLeadDays: DEFAULT_LEAD_DAYS,
  exchangeRates: {},
};

export type BackupData = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  subscriptions: Subscription[];
  settings: Settings;
};
