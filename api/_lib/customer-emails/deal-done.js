import { card, checklist, note, paragraph, renderEmail } from '../email-layout.js';

// Sent after the deal is marked closed (a 'closed' deal_events row).
export function render(buyer) {
  return renderEmail({
    subject: buyer.firstName ? `Congratulations on the new car, ${buyer.firstName}` : 'Congratulations on the new car',
    preheader: 'A short checklist for signing and pickup. I’m still a reply away.',
    kicker: 'Deal done',
    heading: 'Congratulations',
    intro: [`${buyer.firstName ? `Hi ${buyer.firstName}, your` : 'Your'} deal is done. Thank you for trusting me with it. Here’s a short checklist so the paperwork matches what we agreed.`],
    cards: [
      card('Before you sign', [
        checklist([
          'The out-the-door total matches the written number the dealer agreed to.',
          'No add-ons you didn’t agree to, like paint protection, nitrogen-filled tires or VIN etching.',
          'If you’re financing, the rate, term and amount financed match your approval.',
          'The VIN on the contract matches the car you’re buying.'
        ]),
        paragraph([{ b: 'If a number doesn’t match, don’t sign.' }, ' Reply to this email first and I’ll sort it out with the dealer.'])
      ]),
      card('At pickup', [checklist([
        'Walk around the car in good light and look for scratches, dents and curb rash.',
        'Make sure you get every key and anything the dealer promised in writing.',
        'Have proof of insurance ready, and keep copies of everything you sign.'
      ])]),
      card('After you drive off', [
        checklist([
          'Ask the dealer when your plates and registration will arrive, and how.',
          'Questions later about the paperwork or the warranty? Reply here. I’m glad to help.'
        ]),
        note('This checklist is a starting point, not legal or tax advice. Read the final contract terms before you sign.')
      ])
    ],
    signoff: 'Enjoy the new car,'
  });
}
