# Subscriptions

A private subscription tracker for one iPhone. It is an installable web app: no account, no server, and no analytics. Everything you enter stays in IndexedDB on that device.

The home currency is Australian dollars. Dates and calendar alerts use Australia/Brisbane, which is AEST (UTC+10) all year.

Live site, once GitHub Pages is enabled: <https://jjmeta.github.io/subscription-tracker/>

## Install on iPhone

1. Open <https://jjmeta.github.io/subscription-tracker/> in **Safari**. Other iPhone browsers cannot add a proper Home Screen app.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**, then **Add**.

The icon is labelled Subs. After the first online visit, the app works offline, including from the Home Screen.

Safari and the Home Screen app do not share storage. If you type subscriptions in Safari and then install the icon, the icon can open an empty copy. Either enter them in the installed app, or export a backup from Safari and import it after installing.

## Reminders

There is no server, so the app cannot send web push notifications. iPhone also will not run a timer inside a closed web app. Two things cover that:

- **Upcoming**, inside the app, lists every charge in the next 30 days and banners anything inside its reminder window. The default window is 3 days, and each subscription can override it. On the Home Screen, the icon badge shows how many renewals are inside that window. It updates when you open the app (iOS 16.4 or later).
- **Calendar** is the alarm that fires when the app is closed. The app builds an `.ics` file in Australia/Brisbane. Each active subscription is a repeating event at 9:00am on the renewal day, with a `VALARM` for the reminder window.

One file for every subscription is the better default. You import it once, and every cycle uses the matching repeat rule:

| Cycle | Repeat rule |
| --- | --- |
| Weekly | `FREQ=WEEKLY` |
| Monthly | `FREQ=MONTHLY` |
| Quarterly | `FREQ=MONTHLY;INTERVAL=3` |
| Yearly | `FREQ=YEARLY` |
| Every N days | `FREQ=DAILY;INTERVAL=N` |
| Every N weeks | `FREQ=WEEKLY;INTERVAL=N` |
| Every N months | `FREQ=MONTHLY;INTERVAL=N` |

### Add the reminders

1. Open **Upcoming** or **Settings**.
2. Tap **Add all to Calendar**.
3. In Safari, open the downloaded file and tap **Add All**.
4. From the Home Screen app, iOS often ignores a normal download. The button uses the share sheet when the phone allows sharing a file. Open the file with Calendar, or save it to Files and tap it. **Download .ics** is there if you want the file directly.
5. A single subscription has the same actions on its page.

Allow the alerts when Calendar asks. If you change a price, date, or reminder later, delete the old events in Calendar before importing again. Apple Calendar usually adds a second copy instead of updating the first, even though each event has a stable id.

A renewal on the 29th, 30th, or 31st is clamped to the last day of a short month inside the app. Calendar’s monthly rule keeps that day of the month and skips a month that does not have it. The first event in the file is still the next charge the app is showing.

## What you can track

Each subscription has a name, amount, currency (AUD unless you change it), billing cycle, next renewal, category, payment method, notes, and an active or cancelled status. You can edit one, mark it cancelled, or delete it after a confirmation.

When a renewal date is in the past, the app rolls it forward to the next charge. Monthly schedules keep the original day, so the 31st becomes the last day of February and returns to the 31st in March. Cancelled subscriptions stay in the list but leave the totals, the upcoming list, the badge, and the calendar file.

## Spend

**Spend** shows a monthly and a yearly total in AUD, a category breakdown, and each subscription’s monthly equivalent.

- Monthly, quarterly, and yearly cycles count as 12, 4, and 1 charges a year.
- Weekly and custom day or week cycles use a 365.25-day year, so “weekly” and “every 7 days” cost the same.
- A price in another currency is shown in that currency. It is included in the AUD totals only after you type a rate under **Settings → Exchange rates** (`1 USD = … AUD`). No exchange-rate service is called.

## Backup

**Settings → Export backup** writes a JSON file. **Import backup** checks the file, then lets you merge it (matching ids are updated, everything else stays) or replace everything on the device. A bad file is rejected and nothing is changed.

Export a backup before erasing the app’s data, and before moving from Safari to the Home Screen app.

## Fictional examples

The app starts empty. **Load fictional examples** adds invented subscriptions such as Harbour Stream and Northwind VPN so you can try the screens. They are not loaded on their own, and they are not anyone’s real bills. **Remove fictional examples** deletes the ones you have not edited.

## Develop

```bash
npm install
npm test
npm run dev
```

The dev server uses the same `/subscription-tracker/` base path as GitHub Pages, so open the URL Vite prints rather than the site root.

```bash
npm run build
npm run check:dist
npm run preview
```

## Publish

The workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) tests and builds on pull requests. On a push to `main` it also deploys the `dist` folder with GitHub Actions.

This repository cannot turn Pages on by itself. Once, in the GitHub repo:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

The first deploy may also ask you to approve the `github-pages` environment. After it succeeds, the app is at <https://jjmeta.github.io/subscription-tracker/>.

If the workflow cannot deploy, check **Settings → Actions → General → Workflow permissions** and allow Actions to create deployments. The workflow already requests `pages: write` and `id-token: write` for the deploy job.

## What stays on the phone

- No login, no backend, and no third-party scripts or fonts.
- Subscriptions, settings, and exchange rates are in IndexedDB.
- The service worker caches the app shell so a later visit works offline. The first visit needs a connection.
- The only way data leaves the phone is if you share or save a backup or a calendar file yourself.
