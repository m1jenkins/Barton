import { avoidList, button, card, checklist, paragraph, renderEmail, safeUrl, steps } from '../email-layout.js';

// With a live Deal Tracker link: a short nudge with the buyer's to-do list. The
// page's Confirming search stage already explains how the search runs and what
// to hold off on, so the email points there instead of repeating it.
function renderTracker(buyer, link) {
  const todo = [
    buyer.paying === 'finance' && 'Get a loan pre-approval from your bank or a credit union, and send it on your Deal Tracker. It gives the dealer a rate to beat.',
    buyer.paying === 'unknown' && 'If you might finance, get a pre-approval from your bank or a credit union, and send it on your Deal Tracker.',
    buyer.hasTradeIn && 'Get an instant offer for your trade-in from an online car buyer, and add a few photos of it on your Deal Tracker. The offer sets a floor for the dealer’s trade number.',
    'Line up insurance for the new car before pickup day.',
    'Tell me if anything changes, like your budget or timing.'
  ].filter(Boolean);
  return renderEmail({
    subject: 'Your to-do list for the car search',
    preheader: 'A few things that help from your side, and one to hold off on.',
    kicker: 'Deal Tracker',
    heading: 'Your to-do list',
    intro: [`${buyer.firstName ? `Hi ${buyer.firstName}, here’s` : 'Here’s'} your short to-do list. How the search runs is on your Deal Tracker.`],
    cards: [card('Your to-do list', [
      checklist(todo),
      paragraph([{ b: 'Please hold off on' }, ' contacting dealers yourself. It can undercut the prices I’m negotiating.']),
      button(link, 'Open your Deal Tracker')
    ])],
    signoff: 'Talk soon,'
  });
}

// Sent the morning after the welcome email.
export function render(buyer, { tracker } = {}) {
  const link = safeUrl(tracker?.link);
  if (link) return renderTracker(buyer, link);
  const pro = buyer.isPro;
  const helps = [
    'Keep an eye on your email and phone. A quick answer from you keeps a deal moving.',
    'Tell me if anything changes: your budget, your timing or the car itself.',
    buyer.paying === 'finance' && 'Get a loan pre-approval from your bank or a credit union if you haven’t yet. It gives the dealer a rate to beat.',
    buyer.paying === 'unknown' && 'If you might finance, get a pre-approval from your bank or a credit union. It gives the dealer a rate to beat.',
    buyer.hasTradeIn && 'Get an instant offer for your trade-in from an online car buyer. It sets a floor for the dealer’s trade number.',
    'Line up insurance for the new car before pickup day.'
  ].filter(Boolean);

  return renderEmail({
    subject: 'How your car search works, step by step',
    preheader: 'What we do, what helps from your side, and a few things to hold off on.',
    kicker: 'What to expect',
    heading: 'How your search runs',
    intro: [`${buyer.firstName ? `Hi ${buyer.firstName}, here’s` : 'Here’s'} how your search works from here, so nothing comes as a surprise.`],
    cards: [
      card('The search, step by step', [steps([
        { title: 'Confirm the search', body: 'I confirm what you’re after and may ask a question or two. Then your search starts.' },
        {
          title: 'Find the cars',
          body: buyer.isPrivateClient
            ? 'We search dealers nationwide for cars in stock, open allocations and incoming builds, for as many models as you like.'
            : pro
            ? 'We search dealer inventory nationwide, for up to three models.'
            : 'We search dealer inventory within 200 miles of you for cars that match your model and budget.'
        },
        { title: 'Get written prices', body: 'We contact dealers by email and phone and ask for written out-the-door prices: the car, fees, tax and registration.' },
        {
          title: 'Negotiate',
          body: buyer.isPrivateClient
            ? 'We push on price, market adjustments, dealer-installed add-ons and fees, one dealer’s written offer against another’s.'
            : pro
            ? 'We push on price, question add-ons and fees, and play each model’s dealers against each other’s written offers.'
            : 'We push on price and question add-ons and fees, one dealer’s written offer against another’s.'
        },
        {
          title: 'Your call',
          body: buyer.isPrivateClient
            ? 'You get the offers side by side and the deal we’d take. Before you sign, we check the lease or loan terms, the buyer’s order and the finance-office products.'
            : pro
            ? 'You get the offers side by side and the deal we’d take, judged on out-the-door price plus resale and running costs.'
            : 'You get what we found and what we’d do. You decide whether to buy.'
        }
      ])]),
      card('How long it takes', [
        paragraph('It depends on the car and how quickly dealers reply. I’ll tell you when your search starts and keep you posted as written offers come in.')
      ]),
      card('What helps from your side', [checklist(helps)]),
      card('Please hold off on', [avoidList([
        'Contacting the dealers we’re working with. Calling or walking in yourself can undercut the offer we’re negotiating.',
        'Giving anyone your Social Security number, filling out a credit application or putting down a deposit before we’ve talked.',
        'Answering a dealer who reaches out to you directly. Forward it to me and I’ll handle it.'
      ])]),
      card('What stays with you', [
        paragraph('You choose the car and sign for it. The inspection, financing, insurance and registration stay with you, and I’ll point out what to check along the way.')
      ])
    ],
    signoff: 'Talk soon,'
  });
}
