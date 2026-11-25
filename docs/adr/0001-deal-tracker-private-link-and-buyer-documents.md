# Deal Tracker opens from a private link, and Buyer Documents are write-only

The Deal Tracker is the buyer's main channel with us, so getting in has to be effortless. Buyers open it from a private link that is unique to them and hard to guess; there are no accounts or passwords. The link is sent in the welcome email at paid intake and repeated in every Deal Tracker email. It works while the deal is open and for 3 days after the latest close; reopening a deal brings it back, and Mason can revoke or reissue it. Agents can read every table, so the link's secret is never stored where they could read it. The page loads no analytics or tag manager, so the link never reaches a third party.

_Superseded by [0003](0003-dealers-shown-from-quotes-in-and-buyers-text-mason.md) on November 25, 2026, before launch: there is no reply address and no mail reading; buyers text Mason. The rest of this record stands._

Each buyer also has a unique reply address, which delivers to Mason's own mailbox. The site reads only the mail sent to those addresses. An email to it from the buyer's own address becomes a Buyer Question, and its attachments become Buyer Documents. Mail from any other sender is held until Mason releases it, because the address travels with every forwarded email and whatever arrives there is read by agents. Only images and PDFs are filed. Once the link has expired, mail to the reply address still reaches Mason, as ordinary email.

Anyone holding the link gets in, but buyers may still upload ID. So Buyer Documents are write-only through the link: a buyer can add files but never view or download them back, and sees only a receipt of each file's type and time. That way a forwarded or leaked link or email exposes deal progress, never documents. ID can only be added once a price is agreed, when a dealer first needs it. Mason and his agents can open the files, so agents can use details such as a pre-approval rate while negotiating. Every file is deleted 30 days after the deal closes. The original email of a document that arrived by email is moved to the mailbox's trash at the same time, which the mail provider empties 30 days later, so an emailed document can last up to 60 days after close.

## Considered options

- **Email magic link or one-time code before uploading**: rejected for v1 as extra friction, since write-only uploads already keep a leaked link from exposing files.
- **Real accounts (e.g. Neon Auth)**: rejected as too heavy for a single purchase.
The options below about replies and emailed documents are superseded by 0003 along with the reply address.

- **Accepting replies from any sender without review**: rejected. It would let spam, auto-replies and a stranger's crafted email or file reach agents that can read buyer data.
- **Accepting replies only from the buyer's own email address**: rejected, so that a spouse or co-buyer can reply too. Their mail waits for Mason's release instead, and every Buyer Question records the sender's address.
- **A separate mailbox for reply addresses**: rejected to avoid another mailbox to pay for and watch. As a result, the site's mail credential can reach Mason's whole mailbox, and it must be guarded like the database's.
- **Permanently deleting emailed documents at 30 days**: rejected, so the site never holds the power to permanently delete Mason's mail.
- **Mason-only document access**: rejected, because agents running the deal need what's in the documents. As a result, ID images can enter agent context. Revisit this if the agent provider or its data terms change.
