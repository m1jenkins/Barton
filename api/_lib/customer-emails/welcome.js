import { button, card, checklist, note, paragraph, renderEmail, rows, safeUrl, steps } from '../email-layout.js';

const recapCard = buyer => buyer.recap.length && card('What you asked for', [rows(buyer.recap)], 'If anything here is off, reply and tell me.');

function planCard(buyer) {
  const pro = buyer.isPro;
  return card(`Your plan: ${buyer.plan}`, [
    checklist(pro
      ? ['Dealers nationwide, with shipping quotes on long-distance deals',
        'Trade-in support: we compare offers on your trade-in and negotiate it with the deal',
        'Offers on up to three models, priced side by side',
        'Paperwork handled remotely where we can, so you just pick up your car',
        'One advisor, start to finish']
      : ['One model, with any trims, colors and packages',
        'Dealers within 200 miles of you',
        'New, used and certified pre-owned dealer inventory',
        'We negotiate the price and check the fees',
        'One advisor, start to finish'])
  ]);
}

// Sent right after the buyer submits their car search. With options.tracker (a
// live Deal Tracker link), the link card replaces the step-by-step: the page
// itself explains how the search runs.
export function render(buyer, { tracker } = {}) {
  const hi = buyer.firstName ? `Hi ${buyer.firstName}, thanks` : 'Thanks';
  const pro = buyer.isPro;
  const link = safeUrl(tracker?.link);
  const email = {
    subject: buyer.firstName ? `You’re in, ${buyer.firstName}. Here’s what happens next` : 'You’re in. Here’s what happens next',
    kicker: `${buyer.plan} · ${buyer.price}`,
    heading: 'You’re in',
    intro: [`${hi} for choosing Steer Me Right. I’m Mason, and I’ll be working on your car search with you from here.`],
    signoff: 'Talk soon,'
  };
  if (link) {
    return renderEmail({
      ...email,
      preheader: 'Your private Deal Tracker link is inside. I’ll confirm your search within one business day.',
      cards: [
        card('Your Deal Tracker', [
          paragraph('This is your private page for the whole search: where it stands, your cars and their prices, my updates and your documents.'),
          button(link, 'Open your Deal Tracker'),
          note('Keep this link to yourself. Anyone who has it can see how your deal is going.')
        ]),
        recapCard(buyer),
        card('What happens next', [
          paragraph(`Within one business day, I’ll confirm your search and when it starts. From then on, you can follow it on your Deal Tracker.`)
        ]),
        planCard(buyer)
      ].filter(Boolean)
    });
  }
  return renderEmail({
    ...email,
    preheader: 'I’ll reply within one business day to confirm your search and when it starts.',
    cards: [
      recapCard(buyer),
      card('What happens next', [steps([
        {
          title: 'I confirm your search',
          body: `Within one business day, I’ll reply to confirm the details and when your search starts.`
        },
        {
          title: 'We find the cars and work the dealers',
          body: pro
            ? 'We work dealers nationwide, price up to three models side by side and get written out-the-door offers. When the best deal is far away, we get shipping quotes.'
            : 'We search dealer inventory within 200 miles of you for cars that match, get written out-the-door prices, and negotiate the price and fees.'
        },
        {
          title: 'You decide',
          body: pro
            ? 'We tell you which deal we’d take, judged on out-the-door price plus resale and running costs. The decision to buy is yours.'
            : 'We bring you what we found and what we’d do. You see the car, the numbers and the paperwork, and the decision to buy is yours.'
        }
      ])]),
      planCard(buyer)
    ].filter(Boolean)
  });
}
