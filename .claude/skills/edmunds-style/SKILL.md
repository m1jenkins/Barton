---
name: edmunds-style
description: Write car reviews, car-vs-car comparisons, trim guides, "which one should I buy" picks, rivals sections, pros and cons, buying tips and vehicle page copy the way Edmunds' editors do: verdict first, every number set against a rival, every feature turned into what it means on a Tuesday commute, strengths and faults given equal honesty. Use whenever writing or editing copy about a specific vehicle or a choice between vehicles (vehicle price pages, comparison pages, blog reviews, video review scripts, a buyer's car-search write-up), or when Mason says "like Edmunds", "review this car", "compare these two", "which trim" or "write the pros and cons", even if he doesn't name this skill.
argument-hint: <what to write> plus the facts, notes or sources to write it from
---

# Edmunds-style car writing

Edmunds writes for a shopper who is about to spend $40,000 and has one question: is this the right car for me, and which version? Its editors answer that early, prove it with a number or something they noticed, say what is wrong with the car just as plainly, and name what to buy instead. This skill carries that craft. It was built from a close read of Edmunds model pages, comparison tests, first drives, trim guides and rankings in November 2026.

Borrow the method, never the words. Don't copy Edmunds sentences, don't sign anything "Edmunds says", and don't reuse its ratings as ours. On Steer Me Right pages, review scores belong to their publishers and are quoted with a source.

## 1. Sort your facts before you write

Edmunds' authority comes from saying how it knows each thing: "our test truck", "at our test track", "Toyota-estimated", "BMW quotes 3.9 seconds", "we tested a preproduction model". Copy that habit, because a review that blurs what was driven with what was read is the fastest way to lose a buyer's trust.

Put every fact you have into one of three piles, and let the pile choose the verb:

| Pile | What it is | How to write it |
| --- | --- | --- |
| Driven | Mason's or the user's own notes from driving, sitting in or owning the car | "we", "I", "our test car", plain sensory claims |
| Published | Maker specs, EPA, NHTSA, IIHS, a named publication's test result | State it flat for specs ("rated to tow 13,500 pounds"); attribute tests and estimates ("Car and Driver recorded...", "Ford quotes...") |
| Judgment | Your read of what the facts mean for a buyer | "we think", "we'd pick", "expect" |

If the Driven pile is empty, write no sentence that implies a drive: no ride feel, seat comfort, noise or "feels quick" in our own voice. Don't announce that we haven't driven it; report what the people who have say, credited to them by name, and keep the judgment pile ours. Never invent a figure, a test result or an observation to fill a section; cut the section or say what is unknown.

In this repository, every outside figure also needs its dated row in `data/source-registry.csv` (`VEH-*` or `CMP-*`), and vehicle price pages are generated from `data/vehicle-pages.json`. Read `docs/seo/2026-11-15-vehicle-price-pages.md` before touching one.

## 2. The moves that make it sound like Edmunds

**Lead with the verdict.** The first two or three sentences say what the car is, who it suits and the catch. A reader who stops there should still know whether to keep the car on their list. History, generation and what changed come after.

**Claim, proof, payoff.** Nearly every paragraph runs: what we found, the number or detail behind it, what that does for the owner. "Steering is quick" is half a sentence; the other half is that the truck feels smaller in a parking lot. A spec with no payoff is a brochure line, so either finish it or drop it.

**No number travels alone.** A 0-60 time, a cargo figure, an mpg rating or a price always arrives with a yardstick: the class average, a named rival, last year's model, or the EPA estimate it beat or missed. "Pretty good for a pickup, a bit slower than the Ram" tells the buyer more than the seconds do.

**Name the rival.** Rivals appear by name throughout, not only in a rivals section, often as a one-line aside right where the comparison matters (the ride paragraph, the storage paragraph). Each rival gets the one thing it is known for. A rival you have nothing specific and sourced to say about gets a bare mention or is left out; don't tell the reader what you lack.

**Praise, then the catch, in the same paragraph.** Strengths and faults sit side by side, joined by "but", "though" or "however". The fault is specific and physical: the door pocket won't take a big water bottle, the cupholder sits too far forward, the top tether means threading a strap across the cabin. Vague faults ("some cheap plastics") read as filler; findable ones read as someone who was there.

**Test it like an owner.** What counts is the school run, not the lap time: getting a child seat in, where a phone and a laptop go, seeing out, parking, noise at 70 mph, buttons versus screens, whether CarPlay is wireless, what costs a subscription after the trial, what the warranty covers. Lead with these over horsepower unless the car is a performance car.

**Calibrate.** Edmunds grades on a curve where 8 out of 10 is excellent and nothing gets a 10, and its adjectives match: "a bit", "fairly", "quite", "decent", "pretty good", "somewhat". Save "best", "class-leading" and "excellent" for claims a number backs up in the same sentence. One strong word per paragraph lands harder than five.

**Make the call.** Recommend one trim and say which two or three features justify the step up from the one below. Add a conditional for the buyer who differs ("if you tow", "if you drive long highway miles"). In a comparison, rank the cars, say why the winner won, and tell the reader which buyer should pick the runner-up anyway. Hedging the pick is the one thing the format doesn't forgive.

**Be fair to the loser.** Last place still gets its real strengths and a "we'd still recommend it for" line. The tone is an expert friend, not a takedown.

## 3. Sentences

- Second person for the shopper ("you can fit", "you'll pay"), "we" for the publication, "I" only in a bylined drive or opinion piece.
- Short declaratives carry the findings; a longer sentence follows to explain. Vary them. An occasional fragment is fine for a verdict ("Good stuff, generally.").
- Contractions and plain words: quick, roomy, thirsty, pep, soaks up bumps. No marketing register (stunning, bold, elevate, seamless, commanding) and no engineering register without a gloss.
- Explain any driver aid or jargon in a parenthesis the first time, in a clause a non-car person follows: adaptive cruise control (holds a set gap to the car ahead).
- Parentheses also carry the quick rival aside or the exception ("Tremor and Raptor are 4WD only").
- Section headings can be the shopper's question ("How does it drive?", "Is it a good value?") with the answer in the first sentence under it.
- Light humor belongs in a bylined drive piece, one line at most. Spec, price and safety sections stay straight.
- No throat-clearing intros, no closing paragraph that restates the piece. End on the recommendation or the next step (test-drive it, price it, compare the rival).
- A heading over a chart, table or price ladder needs no lead-in sentence explaining what it shows; the data and its note carry it. And don't close a sentence by tagging the facts with a one-word metaphor ("so these are floors", "that's the tell"): say what they mean or cut it.
- No "X, not Y" disclaimers ("estimates, not a promise", "a guide, not a guarantee") and no caveat tacked onto the end of a paragraph. Edmunds labels a figure by its source inside the sentence ("Toyota-estimated", "TrueCar's November averages put..."), and gives a caveat as a concrete consequence where it applies ("expect less room on a Raptor").

Numbers and units, as Edmunds prints them: 0 to 60 mph in 5.8 seconds; 13,500 pounds; 37.8 cubic feet; 24 mpg combined (28 city/33 highway); a 12-inch touchscreen; 2.5-liter four-cylinder; 226 horsepower on first use, then hp; lb-ft; three years/36,000 miles; $46,683 as tested; "starts at $41,395 including destination". Give the trim and drivetrain a figure belongs to. Round nothing a source printed exactly.

Steer Me Right house rules still apply on our pages: say "car search" or "search details", never "brief"; never call Steer Me Right a broker; estimates are labelled as estimates. Label them with a source and date in the sentence ("our estimate from TrueCar's November averages"). Where a page must also say "not a promise" (vehicle price pages, enforced by a test), it says so once, in the sources note, and nowhere in the lead or the tiles.

## 4. What gets covered, in order of weight

A full review walks these, and a short piece picks the three or four that decide this car:

1. Driving: acceleration with a number, braking, steering, ride, visibility, driver aids and how well they behave
2. Comfort: front seats over hours, rear room, child-seat fit, climate controls, noise
3. In-cabin tech: screen size and ease, phone integration, charging, subscriptions
4. Storage and cargo: cubic feet against the class, small-item storage, towing where relevant
5. Value: what you get per dollar, build quality, warranty against rivals
6. Efficiency: EPA combined against the class; for EVs, range, charging speed and home charging
7. For trucks, towing and hauling gets its own section; for EVs, range and charging move up to second
8. The "X factor": style, fun, anything that makes it more or less than its numbers

## 5. Pick the format

Read [formats.md](formats.md) for the skeleton of the piece you're writing: model review page, ranked comparison test, two-car head-to-head, first drive, alternatives roundup, trim guide, rankings blurb, monthly buying tips, pros and cons, FAQ answers. Read [examples.md](examples.md) before your first draft in a session; it shows each move as a weak line and its fix.

## 6. Before you hand it over

- Could a reader stop after the first three sentences and know the verdict?
- Does every number have a yardstick and a named owner (which trim, whose test)?
- Is every fault something a shopper could go and find on the car?
- Is there one clear pick, and a line for the buyer who should choose differently?
- Does any sentence claim a drive that didn't happen, or a figure with no source? Fix those first.
- Read it for brochure words and stacked superlatives, and cut them.
