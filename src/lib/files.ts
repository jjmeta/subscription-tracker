export type DeliverMode = 'auto' | 'download';
export type DeliverResult = 'shared' | 'downloaded' | 'cancelled';

export function chooseDelivery(canShareFiles: boolean, mode: DeliverMode = 'auto'): 'share' | 'download' {
  return mode === 'auto' && canShareFiles ? 'share' : 'download';
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * iPhone Safari can open a downloaded .ics, but a Home Screen app often ignores
 * the download attribute. Share the file when the browser allows it, and fall
 * back to a download otherwise.
 */
export async function deliverFile(input: {
  filename: string;
  mime: string;
  content: string;
  mode?: DeliverMode;
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  download?: (blob: Blob, filename: string) => void;
}): Promise<DeliverResult> {
  const file = new File([input.content], input.filename, { type: input.mime });
  const payload: ShareData = { files: [file], title: input.filename };
  const canShare = input.canShare ?? ((data) => Boolean(navigator.canShare?.(data)));
  const share = input.share ?? ((data) => navigator.share(data));
  const download = input.download ?? triggerDownload;
  if (chooseDelivery(canShare(payload), input.mode ?? 'auto') === 'share') {
    try {
      await share(payload);
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
    }
  }
  download(new Blob([input.content], { type: input.mime }), input.filename);
  return 'downloaded';
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isIos(): boolean {
  const ua = navigator.userAgent;
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

export function isSafari(): boolean {
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome/i.test(ua);
}
