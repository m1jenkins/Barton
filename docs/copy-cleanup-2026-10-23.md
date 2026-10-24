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

## Owner decisions, applied the same day

1. **AI wording:** every mention of an AI-assisted service or an agent that describes Drive Right is gone. The five topic-page cards are now "Car-Buying Service Plans". Mentions of CarEdge's own AI Buying Agent stay on the comparison pages, because they're competitor facts.
2. **Legacy $195 AI Agent plan:** removed entirely.
   - `payment-success-consultant.html` and `ai-car-buying-agent.html` are deleted, and both URLs 301 to `/schedule.html`.
   - The plan's refund terms and fee credit are gone from `policy.html`.
   - Its retired-offer lines are gone from `llms.txt` and `pricing.md`.
   - `script.js` still recognises the old receipt path, so its content hash, and the pins of every page, stay unchanged.
3. **ROI post:**
   - It now uses the $395 fee.
   - The math reads about $4,200 of example savings, roughly $3,800 after the fee.
   - The "Average savings" labels now read "Example".
   - The unattributed "$495 fee paid for itself" quote is deleted, since its figure can't be changed without rewriting the quote.
4. **Lemon law:** both posts now follow the [TxDMV Lemon Law page](https://www.txdmv.gov/motorists/consumer-protection/lemon-law), checked 2026-10-23. Only new vehicles qualify for a refund or replacement. A used car still under the manufacturer's original warranty may get repair help.
5. **Scope:** posts no longer claim services outside the plans:
   - title transfers or registration, title-chain checks, history reports and arranged inspections
   - arranging financing, lender networks, or a promised rate improvement
   - delivery, apart from Pro's shipping coordination
   - a "team" or weekly deal volume

   The matching blog buttons now say what the plans do. The archived Tesla page's search steps are now a buyer's checklist.
6. **Austin hero:** stays as it is.
