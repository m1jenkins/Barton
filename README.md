# Barton
Mid market car conicege 

- [OpenAI Ads tracking setup and activation](docs/openai-ads-setup.md)
- [Drive Right ChatGPT ads strategy and draft copy](docs/openai-ads-marketing.md)

The Daisy-inspired buying experience uses the existing static HTML and JavaScript architecture. Run `npm run preview` and open `http://127.0.0.1:4175` for visual review. The local preview deliberately returns an unavailable response for API requests; it does not charge cards or create live leads. Use a configured development/preview deployment for real Stripe test purchases.

`npm test` runs the backend, advertising, buying-brief, and metro tooling tests. `npm run check:api` and `npm run check:buying` check syntax and site metadata/assets, including metro release eligibility. See [the checks workflow](.github/workflows/checks.yml) for the complete local acceptance commands. The homepage routes are `/#conversation` and `/#brief`; pricing remains `/schedule.html`.

For the private Texas pilot, use the [metro draft generation and preview workflow](docs/metro-execution-2026-09-16.md#files-and-local-workflow). It also documents the evidence and release requirements for moving a draft to a public page.

The [20-city page collection](docs/city-pages-2026-09-17.md) uses `index.html` as its template, changing city references and adding one local sentence. Run `npm run preview:cities` and open `http://127.0.0.1:4177/service-areas.html`. Edit `data/city-pages.json`, regenerate with `npm run draft:cities`, and verify with `npm run check:cities`. The pages share the homepage's design and buying-brief flow. These are private previews; publication follows the existing metro release process.

Shared buying logic lives in `buying/`: Daisy's adapted parser, a versioned brief, an idempotent lead/checkout coordinator, and the page controller. Briefs save locally, fall back to session/history storage, and can be downloaded. When both browser stores are denied, a temporary URL fragment carries only the brief between redesigned pages and is removed on arrival. Contact and checkout retry records use session storage, not the durable brief. Post-payment intake stays behind the existing server verification gate, and car-price budget remains separate from the all-in budget.

Daisy's photographs and Inter body font were reused from the supplied reference project. Buying-page display roles use self-hosted Instrument Serif, paired with Inter for body copy and controls. Font licenses are included in `assets/buying/fonts/`. Responsive coastal-photo derivatives preserve the original composition. Styles are loaded only by the redesigned pages; the added Drive Right rules are scoped to `.dr`.
