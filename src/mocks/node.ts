import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Vitest / Node integration tests */
export const server = setupServer(...handlers);
