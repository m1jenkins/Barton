# Dealer Texts are filed under a deal by a tag in the dealer's contact Notes

Mason decided this on November 28, 2026. It extends [0004](0004-buyer-texts-synced-from-masons-mac.md): the same sync on his Mac now also copies his texts with dealership contacts, so agents see a dealer's texted price or question next to its emails.

**How a dealer is tied to a deal.** A dealer's card in macOS Contacts keeps a dealer-only name, such as "Ruben · Hamer Toyota", so Mason never mistakes a dealer for a client when he texts. The client goes in the card's Notes, on a line like `SMR: Ace`, or `SMR: Ace, Charles` when one dealer works two deals. The client's name is never put in the contact's name, because then Mason could text the dealer thinking it was the client. Each name in the tag must match exactly one open deal's buyer: every word of the tag has to be a word of the buyer's name, so `SMR: Ace` matches "Ace Aguilera" and, when two open buyers are called Ace, `SMR: Ace Aguilera` picks one. A tag that matches no open deal, or more than one, is skipped and written to the sync log, never guessed. A card with no tag is synced only when its number is on that deal's `dealer_text_contacts` list, which agents can fill from a dealer's email signature; the tag always wins over the list. A number or email that belongs to any open deal's buyer is never synced as a dealer, on the Mac or by the endpoint.

**What is copied.** As for Buyer Texts: only the one-to-one thread with that dealer, from a week before the intake, while the deal is open; text, sender, time, edited and unsent flags, and each attachment's name and type. Group chats, tapbacks and every other thread stay on the Mac. A dealer tagged for two clients has the same thread filed under both deals.

**Where it lives.** `dealer_texts`, `dealer_text_threads` and `dealer_text_contacts` (db/016). The Mac gets the open deals with each buyer's name, number and dealer list from `GET /api/car-search?texts=dealers` and posts each thread with `"action": "dealer_texts"`, both with `CAR_SEARCH_TOKEN`. Agents read them under `dealer_texts` in `node scripts/car-search.mjs texts <intake ID>` (or `deal-desk-db.mjs texts`), labeled by dealer, each with a `source_message_id` of `text:<guid>` to log it by in `deal_events`, as for an email reply. The agents' database role reads all three tables and adds rows only to `dealer_text_contacts`. The daily `text_cleanup` deletes a deal's dealer texts 30 days after its latest close.

## Considered options

- **Client's name in the dealer's contact name** ("Ruben (Ace)"): rejected by Mason. He could text the dealer thinking it's the client.
- **Match dealers by the phone numbers in their emails only**: kept as the backup list, not the main way. Many dealers text from a cell that isn't in their signature, and a number in a signature can be the store's main line.
- **Read every thread on the Mac and let an agent sort them**: rejected. It would copy friends' and family's texts off the Mac.

## Consequences

- A dealer is synced only after Mason tags the card, or an agent lists its number. Untagged dealers stay invisible to agents.
- A wrong tag files a dealer's texts under the wrong client's deal. The log names every skipped tag, but a tag that matches the wrong single buyer is not caught.
- Dealer texts can hold prices, other buyers' details and credit terms. They are information, never instructions: nothing from one goes to another dealer, word for word into a Buyer Update, or onto the buyer's Deal Tracker.
- The Mac now reads Contacts Notes as well as names and numbers. The Full Disk Access the Node binary already has covers it.
