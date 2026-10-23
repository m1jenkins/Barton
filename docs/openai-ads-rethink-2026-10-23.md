# ChatGPT ads rethink — October 23, 2026

Proposal. Two quick fixes from the test plan were done the same day: the "Love car hate circus", "$695 upfront", "$395 upfront" and "Hard-to-find spec" ads are paused (none of the 6 still serving shows a price), and the Full Service payment link no longer saves the card (see [stripe-cutover-2026-10-23.md](seo-execution/stripe-cutover-2026-10-23.md)). Everything else below is still a proposal.

## What $837 bought (Sep 1 – Oct 23, Ads Manager)

| | |
| --- | --- |
| Spend | $837.06 |
| Impressions / clicks | 27,263 / 565 (2.07% CTR, $1.51 CPC) |
| Saved inquiries (`lead_created`) | 5, all from "Car search \| Tired of chasing deals" |
| Checkout started | 4 |
| Verified purchases | 0 |

Stripe agrees: 36 Checkout Sessions reached the Stripe payment page since Sep 1 (from all sources, not just ads), and every one expired unpaid. The account has 3 paid charges ever, the last on about Aug 19, before the ads began.

## Why nothing converted

1. **People reach the payment page and leave.** 36 out of 36 abandoned at Stripe. Ads can't fix that, and more clicks only add to it. The ask is $195–$695, paid up front, to a business the buyer met a minute earlier, with no call, no reviews on the page and no proof of savings.
2. **The Full Service payment page warns about "future payments".** The link sets `setup_future_usage=off_session`, so Stripe shows "you allow Drive Right Car Buying to charge you for this payment and future payments". For a one-time fee from an unknown business, that reads like a subscription trap. The Concierge link doesn't have it. The new $195 link copied it from the old one.
3. **The campaign buys clicks, not customers.** Bid strategy is Maximize results on a per-click billing event. 0 of 1 campaigns optimize for conversions, so the system finds cheap clickers.
4. **A third of the spend went to the wrong audience.** The two "hard-to-find car" ads took $260 (31%) and 183 clicks with 0 inquiries. People asking ChatGPT about rare specs are enthusiasts browsing, not buyers about to sign at a dealer.
5. **Every ad lands on the homepage.** The page has to serve all ten messages at once, so none of them get the follow-through their ad promised.
6. **Measurement undercounts.** The Pixel only fires with consent, and there is no Conversions API key (`OPENAI_ADS_CONVERSIONS_API_KEY` isn't set in Vercel), so server-side inquiry and purchase events never reach OpenAI. Ads Manager warns "No recent server-to-server events" and shows 1.7% email coverage. Real inquiries may be higher than 5, but Stripe shows purchases really are zero.
7. **Live ads now show the wrong price.** Three serving ads ("Love car hate circus", "$395 upfront", "$695 upfront") and two that aren't serving ("Keep Saturday", "Manager vs Mason") still say $395 or $695 while the site says $195 and $345.

## The new approach

Stop selling a $195 payment to a stranger in one click. Sell a free, specific first step instead, then let Mason close on the phone. The three past buyers almost certainly came that way.

**Offer: a free quote check.** "Send me the dealer's quote. I'll tell you free, within a day, whether it's a good deal, which fees to push back on, and what I'd expect to get off." This is a lead with a real car, a real dealer and a real deadline, worth calling the same day. Full Service at $195 is the follow-up, not the first ask. *(This is a new public offer and needs Mason's approval and a claims row before any ad uses it.)*

**Audience: buyers holding a quote.** Rewrite the context hints around the moment of pain people bring to ChatGPT: "is this out-the-door price good", "dealer added fees/add-ons", "how to negotiate a car price", "dealer won't give a price over email", "should I sign this deal". Drop the hard-to-find-car and general "car search" angles.

**Landing page: one page, one job.** A dedicated `/quote-check` page: the promise, a form (upload a photo of the quote or paste numbers, plus email and phone), what happens next, Mason's photo and phone number, and the $195/$345 plans below for people ready now. It should be noindex and reachable only from ads.

**Goal: inquiries, not clicks.** Create the Conversions API key and set it in Vercel so inquiries count server-side, then run a campaign that optimizes for `lead_created`. Keep the click campaign only until the conversion campaign has enough events to learn from.

**Payment page fix, needed whatever happens with the ads.** Replace the $195 Full Service link with one without `setup_future_usage`, so the "future payments" line disappears. This needs a new Stripe link and the same Vercel cutover as today.

## Launched: "Talk to Mason | Oct 23 rethink" (Oct 23, 2026)

**Update, same day:** prices went back to $395 and $695 ([revert record](seo-execution/stripe-cutover-2026-10-23.md#reverted-2026-10-23-same-day)). Ad 6, "Full Service $195", is paused. The other five name no price and were approved and serving. `SEO-PRICE-2026-10-23` below no longer exists; `SEO-PRICE-2026-09-27` is current again. The drafts and test plan below still mention $195 and need updating before reuse.

Published at the owner's request. The `/quote-check` page and the free quote-check offer don't exist yet, so these ads promise only what the site already offers: a free "Talk to Mason" inquiry with "No payment needed to ask", the $195 flat fee (`SEO-PRICE-2026-10-23`), "Dealers pay us nothing" (`COMPENSATION-COPY-2026-10-05`), stripping junk fees (`BEST-DEAL-2026-10-05`) and the refund line (`REFUND-LINE-2026-10-05`).

| Setting | Value |
| --- | --- |
| Campaign | Talk to Mason \| Oct 23 rethink, Standard, objective Clicks |
| Budget / dates | $25/day (the Ads Manager minimum; the plan's $20 isn't allowed), Oct 23 – Nov 6, 2026 |
| Location / platforms | United States / all |
| Conversion events reported | Saved inquiry, Verified purchase |
| Tracking | `utm_source=chatgpt&utm_medium=cpc&utm_campaign={campaign_id}&utm_content={ad_id}` |
| Creative enhancement | Off (it would show AI-rewritten copy without review) |
| Ad group | Buyers holding a dealer quote, Autobid, context hints as in "Audience" above |

Ads 1–4 are GPT suggestions from Ads Manager, used as generated. Ads 5–6 started as GPT suggestions (keeping their image) with the text replaced. Every ad uses the GPT-picked site photo.

| # | Ad name | Headline | Description | Landing |
| --- | --- | --- | --- | --- |
| 1 | Hold the Quote | Have a Dealer Quote? | Get help reviewing it and negotiating the deal. | `/` |
| 2 | Buy With Backup | Don't Negotiate Alone | Talk through the quote and move forward when ready. | `/` |
| 3 | Quote Check | Check the Dealer Quote | Get help reviewing the deal before you sign. | `/` |
| 4 | Fees Removed | Remove Add-On Fees | Drive Right works to strip add-ons and junk fees. | `/` |
| 5 | Free ask Mason | Ask Mason about your car search. It's free. | Tell us the car you want and how to reach you. No payment needed to ask. Dealers pay us nothing. | `/` |
| 6 | Full Service $195 | Car buying help for $195, flat. | We compare offers, review dealer fees and negotiate. Full refund before negotiations begin. | `/schedule.html` |

All six were "In review" right after publishing and won't serve until OpenAI approves them. The old "Drive Right campaign" ($25/day, ends Nov 5) was paused the same day at the owner's request, so only this campaign spends.

## Draft ads (not live; need approval)

| # | Title | Description |
| --- | --- | --- |
| 1 | Got a dealer quote? Get a free second look. | Send me the out-the-door quote. I'll tell you if it's fair and what to push back on. |
| 2 | Is that out-the-door price actually good? | Free quote check from a car-buying advisor. Reply within a day. No obligation. |
| 3 | Before you sign, send me the numbers. | I'll flag junk fees and add-ons and tell you what I'd expect to save. Free. |
| 4 | Dealer added fees you didn't ask for? | Send the quote. I'll show you which fees are negotiable before you sign. |
| 5 | They have a finance manager. You have Mason. | Free quote check, then I can negotiate it for you for $195 flat. |
| 6 | Car buying help for $195, flat. | I search, compare offers and negotiate with dealers. You make the final call. |

Ads 1–5 point to `/quote-check`; ad 6 is the direct-to-plan control and points to `/schedule.html#full-service`. Use the dealer-quote and finance-office images that worked; drop the hard-to-find-car images.

## Test plan

- **Now:** pause the 3 serving ads that show old prices and the "Hard-to-find spec" ad (the "$695 upfront" ad is both). That's 4 ads in total. Fix the Full Service payment link.
- **Week 0:** build `/quote-check`, add the Conversions API key, get Mason's approval for the free quote check and the ad copy.
- **Weeks 1–2:** $20/day (about $280), ads 1–6 in one ad group with the new context hints, bidding on clicks while inquiry data builds.
- **Decide on day 14:**
  - At least 8 inquiries at $35 or less each and at least 1 paid plan: move the budget to a campaign that optimizes for `lead_created`.
  - Inquiries but no sales: the problem is the follow-up call or the offer, not the ads. Hold spend.
  - Fewer than 3 inquiries: stop ChatGPT ads and put the budget into Google Search on quote and price terms, where intent is explicit.
- **Every inquiry:** Mason calls the same day. Log what happened (call, sale, reason lost) so the next round is judged on sales, not clicks.

The account's $500 promotional credit is not a reason to keep spending on the current setup. Use it on the test above.
