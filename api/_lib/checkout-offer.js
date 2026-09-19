import { createHash } from 'node:crypto';
import { HttpError } from './http.js';

export function offerKey(tier, service, paymentLink) {
  return createHash('sha256').update(JSON.stringify([tier, service.amount, service.currency, String(paymentLink)])).digest('hex');
}

// Never mutate an old attempt, including attempts whose paid session arrives later.
// Pre-migration attempts have no offer key and must also restart explicitly.
export function assertCurrentOffer(attempt, service, key) {
  if (attempt.expected_amount !== service.amount || attempt.currency !== service.currency || attempt.offer_key !== key) {
    throw new HttpError(409, 'stale_offer', 'Review the current fee and start a new checkout');
  }
}
