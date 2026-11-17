export async function syncAppBadge(count: number): Promise<void> {
  const nav = navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0 && nav.setAppBadge) await nav.setAppBadge(Math.min(count, 99));
    else if (nav.clearAppBadge) await nav.clearAppBadge();
  } catch {
    // iPhone only badges an installed Home Screen app, and only after it has been opened.
  }
}
