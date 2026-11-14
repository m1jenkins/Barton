import { avoidList, card, checklist, paragraph, renderEmail, steps } from '../email-layout.js';

// Sent the morning after the welcome email.
export function render(buyer) {
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
          body: pro
            ? 'We search dealer inventory for up to three models, including out-of-state dealers when it makes sense.'
            : 'We search dealer inventory for cars that match your model, budget and area.'
        },
        { title: 'Get written prices', body: 'We contact dealers by email and phone and ask for written out-the-door prices: the car, fees, tax and registration.' },
        {
          title: 'Negotiate',
          body: pro
            ? 'We push on price, question add-ons and fees, and play each model’s dealers against each other’s written offers.'
            : 'We push on price and question add-ons and fees, one dealer’s written offer against another’s.'
        },
        {
          title: 'Your call',
          body: pro
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
