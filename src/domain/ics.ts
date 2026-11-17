import { describeCycle, effectiveLead } from './schedule';
import { formatMoney } from './money';
import type { BillingCycle, Settings, Subscription } from './types';

const PRODID = '-//jjmeta//Subscription Tracker//EN';

export type CalendarOptions = {
  now: Date;
  settings: Settings;
  urlFor?: (id: string) => string;
};

export function rruleFor(cycle: BillingCycle): string {
  switch (cycle.kind) {
    case 'weekly':
      return 'FREQ=WEEKLY';
    case 'monthly':
      return 'FREQ=MONTHLY';
    case 'quarterly':
      return 'FREQ=MONTHLY;INTERVAL=3';
    case 'yearly':
      return 'FREQ=YEARLY';
    case 'custom':
      if (cycle.unit === 'days') return cycle.every === 1 ? 'FREQ=DAILY' : `FREQ=DAILY;INTERVAL=${cycle.every}`;
      if (cycle.unit === 'weeks') return cycle.every === 1 ? 'FREQ=WEEKLY' : `FREQ=WEEKLY;INTERVAL=${cycle.every}`;
      return cycle.every === 1 ? 'FREQ=MONTHLY' : `FREQ=MONTHLY;INTERVAL=${cycle.every}`;
  }
}

export function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\n|\r/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function utf8Size(lead: number): number {
  if (lead < 0x80) return 1;
  if ((lead & 0xe0) === 0xc0) return 2;
  if ((lead & 0xf0) === 0xe0) return 3;
  if ((lead & 0xf8) === 0xf0) return 4;
  return 1;
}

/** Fold a content line at 75 octets, without splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let offset = 0;
  let budget = 75;
  while (offset < bytes.length) {
    let end = offset;
    while (end < bytes.length && end < offset + budget) {
      const size = utf8Size(bytes[end] ?? 0);
      if (end + size > offset + budget) break;
      end += size;
    }
    if (end === offset) end = Math.min(bytes.length, offset + budget);
    const chunk = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(offset, end));
    parts.push(offset === 0 ? chunk : ` ${chunk}`);
    offset = end;
    budget = 74;
  }
  return parts.join('\r\n');
}

function utcStamp(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function localStamp(isoDate: string, time: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${year}${month}${day}T${time}`;
}

function alarmTrigger(leadDays: number): string {
  if (leadDays <= 0) return 'TRIGGER:PT0S';
  return `TRIGGER:-P${leadDays}D`;
}

function eventDescription(sub: Subscription, lead: number): string {
  const lines = [
    `${formatMoney(sub.amount, sub.currency)} · ${describeCycle(sub.cycle)} · ${sub.category}`,
    sub.paymentMethod ? `Payment: ${sub.paymentMethod}` : '',
    sub.notes.trim(),
    `Reminder: ${lead === 0 ? '9:00am on the day' : `${lead} day${lead === 1 ? '' : 's'} before, 9:00am`} (Australia/Brisbane).`,
  ];
  return lines.filter(Boolean).join('\n');
}

function vevent(sub: Subscription, options: CalendarOptions): string[] {
  const lead = effectiveLead(sub, options.settings);
  const url = options.urlFor?.(sub.id);
  const lines = [
    'BEGIN:VEVENT',
    `UID:${sub.id}@subscription-tracker`,
    `DTSTAMP:${utcStamp(options.now)}`,
    `DTSTART;TZID=Australia/Brisbane:${localStamp(sub.nextRenewal, '090000')}`,
    `DTEND;TZID=Australia/Brisbane:${localStamp(sub.nextRenewal, '093000')}`,
    `RRULE:${rruleFor(sub.cycle)}`,
    `SUMMARY:${escapeIcsText(`${sub.name} renews`)}`,
    `DESCRIPTION:${escapeIcsText(eventDescription(sub, lead))}`,
    'STATUS:CONFIRMED',
  ];
  if (url) lines.push(`URL:${escapeIcsText(url)}`);
  lines.push(
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeIcsText(`${sub.name} renews`)}`,
    alarmTrigger(lead),
    'END:VALARM',
    'END:VEVENT',
  );
  return lines;
}

/**
 * One calendar file for every active subscription.
 * Web push needs a server, so the reminder is a VALARM on a recurring event.
 */
export function buildCalendar(subs: Subscription[], options: CalendarOptions): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Subscriptions',
    'X-WR-TIMEZONE:Australia/Brisbane',
    'BEGIN:VTIMEZONE',
    'TZID:Australia/Brisbane',
    'X-LIC-LOCATION:Australia/Brisbane',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+1000',
    'TZOFFSETTO:+1000',
    'TZNAME:AEST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    lines.push(...vevent(sub, options));
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

export function icsFilename(name?: string): string {
  if (!name) return 'subscriptions.ics';
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `${slug || 'subscription'}.ics`;
}
