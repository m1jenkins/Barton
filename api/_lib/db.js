import postgres from 'postgres';
import { integerEnv, requiredEnv } from './config.js';

let client;

export function database() {
  if (!client) {
    client = postgres(requiredEnv('DATABASE_URL'), {
      max: integerEnv('DATABASE_MAX_CONNECTIONS', 1, { min: 1, max: 5 }),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      transform: { undefined: null }
    });
  }
  return client;
}
