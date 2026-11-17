import { describe, expect, it, vi } from 'vitest';
import { chooseDelivery, deliverFile } from './files';

describe('file delivery', () => {
  it('prefers the share sheet when the browser can share files', () => {
    expect(chooseDelivery(true)).toBe('share');
    expect(chooseDelivery(false)).toBe('download');
    expect(chooseDelivery(true, 'download')).toBe('download');
  });

  it('shares, honours a cancelled sheet, and falls back to download', async () => {
    const content = 'BEGIN:VCALENDAR';
    const share = vi.fn(async () => undefined);
    const download = vi.fn();
    await expect(
      deliverFile({
        filename: 'subscriptions.ics',
        mime: 'text/calendar',
        content,
        canShare: () => true,
        share,
        download,
      }),
    ).resolves.toBe('shared');
    expect(download).not.toHaveBeenCalled();

    const abort = new Error('The user aborted a request.');
    abort.name = 'AbortError';
    await expect(
      deliverFile({
        filename: 'subscriptions.ics',
        mime: 'text/calendar',
        content,
        canShare: () => true,
        share: async () => {
          throw abort;
        },
        download,
      }),
    ).resolves.toBe('cancelled');

    await expect(
      deliverFile({
        filename: 'subscriptions.ics',
        mime: 'text/calendar',
        content,
        canShare: () => false,
        share,
        download,
      }),
    ).resolves.toBe('downloaded');
    expect(download).toHaveBeenCalledOnce();
    const blob = download.mock.calls[0]?.[0] as Blob;
    await expect(blob.text()).resolves.toBe(content);
  });
});
