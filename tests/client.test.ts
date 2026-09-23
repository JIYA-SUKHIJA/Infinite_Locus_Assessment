import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from './setup';
import { fetchApi, ApiError, ApiValidationError } from '../src/api/client';
import { setApiConfig } from '../src/api/config';
import { z } from 'zod';

const TestSchema = z
  .object({
    success: z.boolean(),
    message: z.string()
  })
  .strict();

describe('Typed API Client (fetchApi)', () => {
  beforeEach(() => {
    setApiConfig({
      baseUrl: 'https://api.test.example.com',
      tenantId: 'tenant-secure-456',
      authToken: 'token-secret-jwt'
    });
  });

  it('automatically injects tenant and auth headers and parses valid JSON matching schema', async () => {
    let capturedHeaders: Headers | null = null;

    server.use(
      http.get('https://api.test.example.com/api/test-endpoint', ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json({
          success: true,
          message: 'Operation succeeded'
        });
      })
    );

    const result = await fetchApi(TestSchema, '/api/test-endpoint');

    expect(result.success).toBe(true);
    expect(capturedHeaders !== null).toBe(true);
    expect((capturedHeaders as Headers | null)?.get('x-tenant-id')).toBe('tenant-secure-456');
    expect((capturedHeaders as Headers | null)?.get('Authorization')).toBe('Bearer token-secret-jwt');
  });

  it('injects If-Match header when expectedVersion is supplied', async () => {
    let ifMatchHeader: string | null = null;

    server.use(
      http.patch('https://api.test.example.com/api/test-patch', ({ request }) => {
        ifMatchHeader = request.headers.get('If-Match');
        return HttpResponse.json({
          success: true,
          message: 'Updated'
        });
      })
    );

    await fetchApi(TestSchema, '/api/test-patch', {
      method: 'PATCH',
      expectedVersion: 7
    });

    expect(ifMatchHeader).toBe('"7"');
  });

  it('injects Idempotency-Key header when idempotencyKey is supplied', async () => {
    let idempotencyKeyHeader: string | null = null;

    server.use(
      http.post('https://api.test.example.com/api/test-post', ({ request }) => {
        idempotencyKeyHeader = request.headers.get('Idempotency-Key');
        return HttpResponse.json({
          success: true,
          message: 'Created'
        });
      })
    );

    await fetchApi(TestSchema, '/api/test-post', {
      method: 'POST',
      idempotencyKey: 'idem-uuid-999'
    });

    expect(idempotencyKeyHeader).toBe('idem-uuid-999');
  });

  it('FAILS CLOSED: throws ApiValidationError on unexpected server payload fields', async () => {
    server.use(
      http.get('https://api.test.example.com/api/test-endpoint', () => {
        return HttpResponse.json({
          success: true,
          message: 'Operation succeeded',
          unexpectedUntrustedPayload: 'malicious'
        });
      })
    );

    await expect(fetchApi(TestSchema, '/api/test-endpoint')).rejects.toThrow(ApiValidationError);
  });

  it('parses error envelope and throws typed ApiError on 4xx/5xx responses', async () => {
    server.use(
      http.get('https://api.test.example.com/api/test-error', () => {
        return HttpResponse.json(
          {
            code: 'FORBIDDEN_RESOURCE',
            message: 'Access is denied for this tenant',
            requestId: 'req_forbidden_001',
            fieldErrors: { scope: ['Insufficient permission'] }
          },
          { status: 403 }
        );
      })
    );

    try {
      await fetchApi(TestSchema, '/api/test-error');
      expect.unreachable('Should have thrown ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(403);
      expect(apiErr.code).toBe('FORBIDDEN_RESOURCE');
      expect(apiErr.message).toBe('Access is denied for this tenant');
      expect(apiErr.requestId).toBe('req_forbidden_001');
      expect(apiErr.fieldErrors?.scope).toContain('Insufficient permission');
    }
  });

  it('handles AbortSignal cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      fetchApi(TestSchema, '/api/test-endpoint', {
        signal: controller.signal
      })
    ).rejects.toThrow();
  });
});
