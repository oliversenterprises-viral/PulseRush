# PulseRush Data Safety (Play Console answers)

Package: `app.pulserush.arcade`

Game saves (name, scores, coins, skins, streak, sound/haptics) stay on the device in local storage. PulseRush does not operate an account or a player database.

The **Android / Play build** includes Google AdMob. Declare that honestly. A “no data collected” answer will get the app rejected.

## Data collected (Play build, via AdMob)

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Device or other IDs (GAID) | Yes (AdMob) | Yes (advertising) | Advertising |
| App activity (ad interactions) | Yes (AdMob) | Yes | Advertising |
| Diagnostics (crash/ad errors) | Optional via AdMob | Yes | Analytics / advertising |
| Approximate location | May be, via AdMob | Yes | Advertising |

## Data collected (web build)

None beyond what the browser stores locally. No AdMob.

## Other form answers

- App does **not** require an account
- Users can delete local data by clearing app storage
- Encrypted in transit: Yes (HTTPS / Google ads SDK)
- Data encrypted at rest: N/A for our local scores; AdMob follows Google
- Independent security review: No
- Designed for children: **No**
- Target age: 13+

Privacy policy URL: https://pulserush-six.vercel.app/privacy.html
