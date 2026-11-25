# Dealers show from Quotes in, and buyers text Mason instead of asking on the page

Mason decided this on November 25, 2026, before the Deal Tracker launched. It replaces the reply address in [0001](0001-deal-tracker-private-link-and-buyer-documents.md) and Buyer Questions in [0001](0001-deal-tracker-private-link-and-buyer-documents.md) and [0002](0002-buyer-records-outside-the-deal-log.md).

**Dealers from Quotes in.** Buyers want to see the exact car they're getting: the listing's photos and details, the dealer and a link to the listing. Every car on the shortlist shows its photos and details. From Quotes in, each car also names its dealer and location and links its listing. Before Quotes in, dealer names, listing links and VINs stay hidden, so the first written prices come in from dealers who haven't heard from the buyer. Target and walk-away prices never show. The page asks the buyer not to contact the dealers. The site fetches each photo itself and serves it from the buyer's own link (`/deal/<token>/photo/<rank>/<n>`), so a photo's host can't name the dealer before Quotes in.

**Texting instead of questions.** Buyers already text, and a text is easier for them and for Mason than a box on the page or a special email address. So there are no Buyer Questions, no per-buyer reply address and no mail reading. The page shows Mason's number from `DEAL_TRACKER_TEXT_NUMBER` as "Text me at …". Unset, it says to email him. Buyer Picks and Buyer Documents uploaded on the page stay as they were.

## Considered options

- **Dealers hidden until a price is agreed** (the first design): rejected. Buyers want to look the car up, and Mason would rather show it than have them search for it.
- **Dealers shown from the shortlist**: rejected. A buyer who calls a dealer before the dealer has quoted in writing can cost us the price.
- **Photos linked straight from the dealer's photo host**: rejected. The address often names the dealer, which would show it before Quotes in.
- **Questions on the page plus a reply address read through Gmail**: built, then dropped before launch. It needed a Google Cloud OAuth client with access to the whole mailbox, held mail for unknown senders and a mail job, all for something a text does.
- **A business texting line the site reads** (for example Quo, formerly OpenPhone, which has an API and webhooks): not decided. US carriers require A2P 10DLC registration before it can text buyers. Mason is weighing a dedicated business number; until then the number is just shown.

## Consequences

- From Quotes in, a buyer can go around us to the dealer. The page asks them not to, and that's the only guard.
- Serving photos from the buyer's link hides where a photo lives, not what's in it. Listing photos often carry a dealer's watermark, banner, lot sign or plate frame, so a buyer may still spot the dealer before Quotes in. Mason accepted that for photos from the shortlist on.
- Photo addresses from a listing feed usually name the dealer (for example a host or path with the dealer's site in it), which is why the page never links them.
- Texts live outside the system. Agents can't read them, nothing reaches the deal log or the ops dashboard, and there is no alert for an unanswered text. Anything an agent needs from a text, Mason has to pass on.
- Agents' Buyer Updates may name dealers from Quotes in. The ops dashboard warns only about drafts and updates that name a dealer before then.
