import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';
import { beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { resetApiConfig, setApiConfig } from '../src/api/config';

export const server = setupServer(...handlers);

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  resetApiConfig();
  setApiConfig({
    baseUrl: 'https://api.test.example.com',
    tenantId: 'tenant-test-123'
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
