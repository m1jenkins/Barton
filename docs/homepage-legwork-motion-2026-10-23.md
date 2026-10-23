# Homepage legwork videos (2026-10-23)

The three "How we do the legwork." cards on the homepage (and the generated city drafts) now show short Remotion videos instead of the static SVG drawings. The session user asked for completely new animations that read instantly while scrolling; nothing from the old drawings had to stay.

## What each card shows

All three star the Mariner Blue Miata header mascot, so the cards tell one story: find the car, get the price, take the keys.

| Card | Video | On-screen text |
| --- | --- | --- |
| Search & outreach | A search is typed, envelopes fly out to a whip-panning lot of grey cars, and the viewfinder locks onto the blue Miata. | "Mariner Blue Miata, manual" |
| Compare & negotiate | Three offer tags drop onto a rail. Call and email bubbles knock them about, strike their fee lines and shorten their price bars. Two offers fall away and the last one gets a "Below MSRP" sticker. | "Offer A", "Offer B", "Offer C", "Car price", "Fees", "Below MSRP" |
| Pick up the keys | The review boxes are ticked and the paperwork signed. The Miata rolls in, the key fob clicks, and the pop-up headlights flip up and switch on. | "For your review", "Read the terms", "Your decision", "Your signature" |

No amounts, dealer counts or savings figures appear. "Below MSRP" reuses the approved MSRP-DISCOUNT-2026-09-28 wording; the review labels reuse the old drawing's text. Each card's `aria-label` describes the animation and carries the old drawings' caveats, including the Concierge shipping line on card 3 (CONCIERGE-SCOPE-2026-10-05).

## How they play

- `buying/home.js` loads a video when it is within 400px of the screen and plays it once when 55% of it is visible. Cards that arrive together start left to right, 0.45s apart. A video replays after it has fully left the screen and come back.
- Each video runs 5 seconds and holds its last frame, so it stays within WCAG 2.2.2 without a pause control.
- With `prefers-reduced-motion: reduce`, without JavaScript, or if the browser refuses playback, the `poster` (the last frame) is shown instead.

## Editing or re-rendering

Source: `motion/legwork/` (Remotion 4, not deployed). `src/Search.jsx`, `src/Negotiate.jsx` and `src/Keys.jsx` are the three scenes. `src/shared.jsx` holds the homepage palette, fonts and mascot sprite helper.

```sh
cd motion/legwork
npm ci
npm run studio   # live preview
npm run render   # writes assets/buying/legwork/{search,negotiate,keys}.{mp4,webp}
```

After a render, run `node scripts/validate-site.mjs` from the repo root. It reports the new `?v=` hashes for the video and poster URLs in `index.html`. Then run `npm run draft:cities` so the city drafts match the homepage.
