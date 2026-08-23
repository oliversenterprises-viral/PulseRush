# PulseRush — shipping to Google Play

Package: `app.pulserush.arcade`
Version: 1.0.0 (versionCode 1)
Target SDK: 36 (required for new apps from 31 Aug 2026)
Format: Android App Bundle (.aab)

## What is already built

- Playable game in `www/`
- Viral challenge links + score cards
- AdMob wiring (Google **test** ad unit IDs)
- Privacy policy at `www/privacy.html`
- Store copy in `store/listing.md`
- Icon + feature graphic in `www/assets` and `store/`

## What Google will not let an agent finish alone

1. **Google Play Developer account** — $25 one-time, identity verification. Play emails on this machine go to bluetoothmarketer@gmail.com, but that is a Play *store* mailbox, not proof of a developer console.
2. **Closed testing (personal accounts created after 13 Nov 2023)** — 12 testers opted in for 14 continuous days before production.
3. **AdMob app + real ad unit IDs** — replace the test IDs in `www/js/ads.mjs` after the app exists in AdMob and is linked to Play.
4. **Play Console login** — upload the AAB, fill Data safety, content rating, ads declaration.

## Build a signed AAB (hands-free on this PC)

```
cd C:\Users\olive\Projects\PulseRush
npm install
npx cap add android
npx cap sync android
```

Then `node scripts/build-aab.mjs` (creates a local upload keystore if missing, never commit it).

Output: `android/app/release/app-release.aab`

## Closed test testers

Send testers the Play Console opt-in link (not a random APK). They must stay opted in for 14 days.

## Viral loop (live on the web immediately)

The web build is the growth engine. Friends do not need Play to be challenged.

1. Play a run
2. Tap **Challenge a friend**
3. They open `https://pulserush-six.vercel.app/?c=SCORE&n=NAME`
4. They try to beat it and share back

Web first, Play second. Play review does not block the loop.
