# PulseRush

One-thumb neon arcade. Tap the pulse. Challenge a friend.

## Play

Open `www/index.html` or run `npm start` and visit http://localhost:4173

## Why it spreads

Every game over is a dare. The share card + link carries your score. The friend lands in the same game with your number on the banner. If they beat you, the app prompts them to share again.

Daily mode uses one UTC seed so everyone is on the same pattern.

## Stack

- HTML5 Canvas + ES modules
- Capacitor 8 / Android API 36 for Play
- AdMob rewarded continue + rate-limited interstitials (native only)
- localStorage only — no account

## Tests

`npm test`
