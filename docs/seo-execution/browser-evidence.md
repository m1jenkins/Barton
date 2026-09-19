# Candidate browser and preview evidence

September 18, 2026, America/Los_Angeles / September 19 UTC. Node `v24.20.0`; isolated `chrome-devtools-axi` Chrome sessions. The final implementation revision is identified in [release-candidate.md](release-candidate.md). These were loopback previews, not production purchases.

## Commercial and checkout UI

Final mobile regression: `390 × 844`, device scale 3, mobile/touch, Fast 4G, CPU 1; preview `http://127.0.0.1:4175/`. All assertions passed after the final shared asset and tracking-bootstrap changes.

| Scenario | Observed result |
| --- | --- |
| Old `/schedule.html#contact-consultation` | Changes to `#retired-plan`, focuses explanation, opens no plan modal, creates no request |
| Full Service selection | Dialog displays $295; Tab stays in the dialog; Escape closes it |
| Stale offer response | Current $295 price, retained details and enabled **Restart checkout** action |
| Explicit restart | One lead request, two checkout requests with different attempt keys; one durable lead event, no checkout event when the URL request fails |
| Direct historical AI receipt without session | Verified intake stays hidden; helpful receipt-link error; zero purchase events |
| Five commercial pages | No horizontal overflow; one appropriate H1, expected title and canonical; current national offer visible |

For the restart regression, only `/api/leads` and `/api/checkout-start` were intercepted in the local browser. Responses were synthetic: lead 201, stale checkout 409, retry 503. No real lead, charge or collector event was created by these endpoints. This proves UI handling, not connected API/Stripe integration. Signature/ledger/legacy behavior is covered separately by application fixtures and remains subject to the connected gate.

Desktop checks at `1440 × 1000`, Fast 4G, CPU 1 passed for homepage, pricing, process, About and Resources: no overflow, current $295 text, correct headings; home/pricing/process each render two plan cards. No unsupported office or additional offer was introduced.

## JavaScript disabled

A separate `seo-nojs` browser launched with `--blink-settings=scriptEnabled=false`. Actual accessibility snapshots were inspected on all five commercial pages. Essential headings, service explanation, $295 price, ordinary navigation and contact links remain rendered. Home/pricing expose the noscript phone/plan fallback. Dynamic brief/checkout actions correctly require JavaScript; no dynamic ad-privacy panel appeared. Runtime evaluation was not used as proof in the disabled browser.

## Private containment and content

The updated ordinary preview was separately started on loopback `4198`. `/` returned 200 with `X-Robots-Tag: noindex, nofollow`; docs, service data, private worksheet, test source and `.env` returned 404. Payment API routes return 503 rather than creating leads/charges. This preview does not emulate Vercel redirects; the redirect-config check and later live matrix are separate evidence.

[SEO-05](SEO-05.md) records private guide desktop/mobile rendering and exact-copy hashes. Public root guides retain the earlier editorial bodies/dates plus the approved offer CTA and measured template loading-order fix; new editorial revisions are deployment-excluded.

[SEO-06](SEO-06.md) records worksheet checks at 1440, 390 and 320 px, keyboard focus/validation, hypothetical arithmetic, CSV provenance, no external requests/storage and actual three-page print output. Its private server refuses API, traversal and mutation requests. No customer data was used.

The final code review reproduced and resolved historical request-hash compatibility, old queued-payload privacy and real Stripe-origin attribution. Thirty-five targeted tests and the full **160-test** suite passed. [Performance evidence](performance-evidence.md) records the separate controlled lab traces; no field INP or connected business-conversion success is inferred from these UI checks.
