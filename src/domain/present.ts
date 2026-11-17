import type { Subscription } from './types';

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((word) => [...word][0] ?? '');
  const value = letters.join('').toUpperCase();
  return value || '?';
}

export function matchesQuery(sub: Subscription, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [sub.name, sub.category, sub.paymentMethod, sub.notes, sub.currency].join(' ').toLowerCase();
  return needle.split(/\s+/).every((part) => haystack.includes(part));
}

export function partitionSubscriptions(subs: Subscription[]): { active: Subscription[]; cancelled: Subscription[] } {
  const active = subs
    .filter((sub) => sub.status === 'active')
    .sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal) || a.name.localeCompare(b.name, 'en-AU'));
  const cancelled = subs
    .filter((sub) => sub.status === 'cancelled')
    .sort((a, b) => a.name.localeCompare(b.name, 'en-AU'));
  return { active, cancelled };
}
