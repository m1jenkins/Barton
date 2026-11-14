import { card, checklist, paragraph, renderEmail, rows, steps } from '../email-layout.js';

// Sent right after the buyer submits their car search.
export function render(buyer) {
  const hi = buyer.firstName ? `Hi ${buyer.firstName}, thanks` : 'Thanks';
  const pro = buyer.isPro;
  return renderEmail({
    subject: buyer.firstName ? `You’re in, ${buyer.firstName}. Here’s what happens next` : 'You’re in. Here’s what happens next',
    preheader: 'I’ll reply within one business day to confirm your search and when it starts.',
    kicker: `${buyer.plan} · ${buyer.price}`,
    heading: 'You’re in',
    intro: [`${hi} for choosing Steer Me Right. I’m Mason, and I’ll be working on your car search with you from here.`],
    cards: [
      buyer.recap.length && card('What you asked for', [rows(buyer.recap)], 'If anything here is off, reply and tell me.'),
      card('What happens next', [steps([
        {
          title: 'I confirm your search',
          body: `Within one business day, I’ll reply to confirm the details and when your search starts.${pro ? ' Pro searches start ahead of the line.' : ''}`
        },
        {
          title: 'We find the cars and work the dealers',
          body: pro
            ? 'We price up to three models side by side, get written out-the-door offers, and play each model’s dealers against each other’s offers.'
            : 'We search dealer inventory for cars that match, get written out-the-door prices, and negotiate the price and fees.'
        },
        {
          title: 'You decide',
          body: pro
            ? 'We tell you which deal we’d take, judged on out-the-door price plus resale and running costs. The decision to buy is yours.'
            : 'We bring you what we found and what we’d do. You see the car, the numbers and the paperwork, and the decision to buy is yours.'
        }
      ])]),
      card(`Your plan: ${buyer.plan}`, [
        checklist(pro
          ? ['Offers on up to three models, priced side by side',
            'Out-of-state dealers, with help coordinating shipping when the dealer is open to it',
            'Paperwork handled remotely where we can, so you just pick up your car',
            'One advisor, start to finish']
          : ['One model, with any trims, colors and packages',
            'New, used and certified pre-owned dealer inventory',
            'We negotiate the price and check the fees',
            'One advisor, start to finish']),
        !pro && paragraph('Torn between a few models? You can move to Steer Me Right Pro any time by paying the $300 difference.')
      ])
    ].filter(Boolean),
    signoff: 'Talk soon,'
  });
}
