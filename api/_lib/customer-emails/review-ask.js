import { HELLO, button, card, paragraph, renderEmail, safeUrl } from '../email-layout.js';

// Sent four days after the deal-done email. Needs GOOGLE_REVIEW_URL.
export function render(buyer, { reviewUrl } = {}) {
  const href = safeUrl(reviewUrl);
  if (!href) throw new Error('The review email needs an https GOOGLE_REVIEW_URL');
  return renderEmail({
    subject: buyer.firstName ? `How’s the new car, ${buyer.firstName}?` : 'How’s the new car?',
    preheader: 'If we made buying it easier, a quick Google review would mean a lot.',
    kicker: 'Thank you',
    heading: 'How did we do?',
    intro: [`${buyer.firstName ? `Hi ${buyer.firstName}, I` : 'I'} hope the first few days with the new car have been good.`],
    cards: [
      card('A minute of your time', [
        paragraph('If Steer Me Right made buying your car easier, a short Google review would mean a lot. It’s one of the main ways other buyers find us.'),
        button(href, 'Leave a Google review'),
        paragraph('If something didn’t go the way it should have, I’d rather hear it from you first. Just reply to this email.')
      ]),
      card('Know someone dreading their next car?', [
        paragraph(['Send them my way. They can start at steermeright.com or email ', { b: HELLO }, '.'])
      ])
    ],
    signoff: 'Thanks again,'
  });
}
