# Copy cleanup, 2026-10-23

Mason approved a plain-language pass over the public site copy. It removes AI-sounding filler: legalese ("participating sellers", "written terms", "material relationships", "engagement-specific logistics"), stacked noun lists, copy repeated within a page, slogan pull-quotes, "X isn't Y, it's Z" constructions, and the comma splices left by an earlier em-dash removal. Facts, prices, dates, laws, competitor facts and links did not change.

## Scope

- Main pages: `index.html`, `about.html`, `how-it-works.html`, `schedule.html`, `car-buying-service.html`, `blog.html`, `texas-local-market-intelligence.html`, `compare-car-quotes.html`, `payment-success*.html`, `houston.html`.
- The shared plan cards on the six pages that carry them:
  - The Drive Right description drops the "You know the car you want." lead where the "Best if you know the car you want" label sits above it.
  - The Pro description now reads "We price up to three models and tell you which deal we'd take."
- The Texas city pages, `austin.html`, the five topic pages, `delivrd-alternatives.html`, `used-car-buying-service.html` and `tesla-fsd-for-sale.html`. The Tesla page is trimmed only and keeps its noindex disposition.
- The blog posts, except `blog-used-car-inspection-checklist.html`, which was already plain.
- Not edited: `policy.html` (legal text), the redirected `inquiry.html` and `ai-car-buying-agent.html`, `success.html`, and form labels.

## Records updated

- `data/claims.csv`:
  - `PRO-SCOPE-2026-10-23`, `DRIVE-RIGHT-SCOPE-2026-10-23` and `PLAN-UPGRADE-2026-10-23` have the new card and FAQ strings.
  - `SAVINGS-ADDONS-2026-10-05`: the unmeasured "average car buyer saves thousands" lead is replaced by "Add-ons and junk fees can add thousands to a deal."
  - `BEST-DEAL-2026-10-05`: notes that the homepage line is now "One deal worth signing." It stays approved because the OpenAI ads cite it.
- `data/metro-release.json`: the nine Texas pages are re-pinned.
- `draft-artifacts/`: the city and metro drafts are regenerated from the new `index.html`.

## Open owner decisions (not changed)

1. The topic-page cards call the service "AI-assisted", while the comparison pages sell one dedicated advisor in contrast to AI agents. Keep the word only if it's accurate.
2. `blog-roi-car-buying-service.html` uses a $495 fee, but the plans are $395 and $695. Its "$4,000 net" doesn't match its own figures either: $2,100 + $1,300 + $800 − $495 = $3,705.
3. The lemon-law statements conflict. `blog-private-party-vs-dealership.html` says the law covers some used dealer purchases; `blog-texas-car-buying-laws.html` says it covers no used vehicles.
4. Some older posts promise more than the plans cover:
   - rip-offs: "verify title chains across state lines"
   - title-transfer: "handles the entire post-purchase process"
   - spot-delivery: "never face a callback"
5. The `austin.html` hero says "here for Texas buyers", while the footer and the rest of the site say nationwide.
