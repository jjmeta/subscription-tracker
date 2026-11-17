import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, daysInMonth, formatYMD, parseYMD, todayInBrisbane } from './dates';

describe('calendar dates', () => {
  it('knows leap years and rejects impossible days', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(parseYMD('2025-02-29')).toBeNull();
    expect(parseYMD('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
    expect(parseYMD('2026-13-01')).toBeNull();
    expect(parseYMD('17/11/2026')).toBeNull();
  });

  it('adds days across month and year boundaries', () => {
    expect(formatYMD(addDays({ year: 2026, month: 11, day: 30 }, 2))).toBe('2026-12-02');
    expect(formatYMD(addDays({ year: 2026, month: 12, day: 31 }, 1))).toBe('2027-01-01');
    expect(daysBetween({ year: 2026, month: 11, day: 10 }, { year: 2026, month: 11, day: 17 })).toBe(7);
  });

  it('clamps month addition to the anchor day', () => {
    const jan31 = { year: 2025, month: 1, day: 31 };
    expect(formatYMD(addMonths(jan31, 1, 31))).toBe('2025-02-28');
    expect(formatYMD(addMonths(jan31, 2, 31))).toBe('2025-03-31');
    const leap = { year: 2024, month: 2, day: 29 };
    expect(formatYMD(addMonths(leap, 12, 29))).toBe('2025-02-28');
    expect(formatYMD(addMonths(leap, 48, 29))).toBe('2028-02-29');
  });

  it('uses the Australia/Brisbane calendar date', () => {
    expect(todayInBrisbane(new Date('2026-11-16T13:59:00Z'))).toBe('2026-11-16');
    expect(todayInBrisbane(new Date('2026-11-16T14:00:00Z'))).toBe('2026-11-17');
  });
});
