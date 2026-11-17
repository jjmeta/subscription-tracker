import { buildCalendar, icsFilename } from '../domain/ics';
import type { Settings, Subscription } from '../domain/types';
import { deliverFile, isStandalone, type DeliverMode, type DeliverResult } from './files';

export function calendarResultMessage(result: DeliverResult): string | null {
  if (result === 'cancelled') return null;
  if (result === 'shared') {
    return 'In the share sheet, open the file with Calendar. If Calendar is not listed, save it to Files and then tap the file.';
  }
  if (isStandalone()) {
    return 'If nothing opened, share the file again and save it to Files, then tap it to add the reminders.';
  }
  return 'Calendar file downloaded. Open it and add the events. The alerts use Australia/Brisbane.';
}

export async function shareCalendar(
  subscriptions: Subscription[],
  settings: Settings,
  mode: DeliverMode,
  name?: string,
): Promise<string | null> {
  const active = subscriptions.filter((subscription) => subscription.status === 'active');
  if (!active.length) return 'There are no active subscriptions to add.';
  const content = buildCalendar(active, {
    now: new Date(),
    settings,
    urlFor: (id) => `${location.origin}${import.meta.env.BASE_URL}#/sub/${encodeURIComponent(id)}`,
  });
  const result = await deliverFile({
    filename: icsFilename(name),
    mime: 'text/calendar',
    content,
    mode,
  });
  return calendarResultMessage(result);
}
