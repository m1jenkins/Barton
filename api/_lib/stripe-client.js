import Stripe from 'stripe';
import { requiredEnv } from './config.js';

let client;

export function stripeClient() {
  if (!client) {
    client = new Stripe(requiredEnv('STRIPE_SECRET_KEY'), {
      apiVersion: '2026-02-25.clover',
      maxNetworkRetries: 2,
      timeout: 10000
    });
  }
  return client;
}
