# What the buyer does stays out of the deal log, but agents can publish Buyer Updates

Everything else about a deal lives in the deal log, and agents add rows to it freely. The Deal Tracker shows buyers some of that log and takes input back from them. So what the buyer did (Buyer Questions, Buyer Picks, asking us to keep looking, Buyer Documents) needs a stronger guarantee than "an agent logged it". Those records are kept apart from the deal log, where only the website can write them. Agents can read them but can never record one as if it came from the buyer.

Buyer Updates get no such guarantee. Mason wants to drop information into a chat with an agent and have it appear on the Deal Tracker, so an agent publishes an update when Mason tells it to. An update an agent writes unprompted, such as an answer to a Buyer Question, waits for Mason's approval. The system can't tell those two cases apart; it relies on agents following the rule. Two things limit the damage of a mistake: the buyer's email about an update goes out a few minutes after it is posted, and Mason can take any update back.

## Considered options

- **Buyer records as new kinds of row in the deal log**: rejected. It is the simplest build and keeps the ops dashboard reading one log, but any agent that can add a row could then invent a Buyer Pick.
- **Only Mason can publish a Buyer Update, by a tap the agents can't make**: rejected as too slow for how Mason works. It was the first design, and it is the one to return to if an agent ever publishes something it shouldn't.
- **Agents publish freely**: rejected. Every word a buyer reads should be one Mason asked for or approved.
