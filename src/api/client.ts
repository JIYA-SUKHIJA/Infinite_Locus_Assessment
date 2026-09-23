import { z } from 'zod';
import { ApiErrorEnvelopeSchema, ApiErrorEnvelope } from './schemas';
import { getApiConfig } from './config';

/**
 * Custom Error for API errors (4xx, 5xx).
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly requestId: string;
  public readonly fieldErrors?: Record<string, string[]>;
  public readonly rawEnvelope?: ApiErrorEnvelope;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string,
    fieldErrors?: Record<string, string[]>,
    rawEnvelope?: ApiErrorEnvelope
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    if (fieldErrors) {
      this.fieldErrors = fieldErrors;
    }
    if (rawEnvelope) {
      this.rawEnvelope = rawEnvelope;
    }
  }

  public isConflict(): boolean {
    return this.status === 409 || this.code === 'CONFLICT' || this.code === 'VERSION_CONFLICT';
  }
}

/**
 * Custom Error for runtime schema validation failures (failing closed).
 */
export class ApiValidationError extends Error {
  public readonly status = 502; // Bad Gateway / Invalid Server Contract
  public readonly code = 'SCHEMA_VALIDATION_ERROR';
  public readonly zodError: z.ZodError;

  constructor(zodError: z.ZodError) {
    super(`API response failed runtime schema validation: ${zodError.message}`);
    this.name = 'ApiValidationError';
    this.zodError = zodError;
  }
}

/**
 * Converts any caught error into a strongly-typed ApiError without unsafe casts.
 */
export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) {
    return err;
  }
  if (err instanceof ApiValidationError) {
    return new ApiError(502, 'SCHEMA_VALIDATION_ERROR', err.message, 'req_validation_failure');
  }
  if (err instanceof Error) {
    return new ApiError(0, 'UNKNOWN_ERROR', err.message, 'req_err_unknown');
  }
  return new ApiError(0, 'UNKNOWN_ERROR', String(err), 'req_err_unknown');
}

export interface FetchApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  expectedVersion?: number;
  idempotencyKey?: string;
}

/**
 * Core Typed API Client.
 * Validates responses against Zod schemas before returning, failing closed on unexpected structures.
 * Enforces headers-only tenant/auth context.
 */
export async function fetchApi<T>(
  schema: z.ZodType<T>,
  endpoint: string,
  options: FetchApiOptions = {}
): Promise<T> {
  const config = getApiConfig();
  let base = config.baseUrl;
  if (!base && typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
    base = window.location.origin;
  }
  const url = base ? `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}` : endpoint;

  const requestHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers
  };

  // Inject tenant context securely via headers only
  if (config.tenantId) {
    requestHeaders['x-tenant-id'] = config.tenantId;
  }

  // Inject auth token if available
  if (config.authToken) {
    requestHeaders['Authorization'] = `Bearer ${config.authToken}`;
  }

  // Inject optimistic concurrency version check using standard HTTP If-Match header
  if (options.expectedVersion !== undefined) {
    requestHeaders['If-Match'] = `"${options.expectedVersion}"`;
  }

  // Inject idempotency key header for safe retry / non-duplicated submissions
  if (options.idempotencyKey) {
    requestHeaders['Idempotency-Key'] = options.idempotencyKey;
  }

  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: requestHeaders
  };

  if (options.body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  if (options.signal !== undefined) {
    init.signal = options.signal;
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    // If request was aborted, rethrow abort exception directly for hook cancellation handling
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network request failed',
      'req_network_failure'
    );
  }

  // Handle Non-2xx responses
  if (!response.ok) {
    let rawJson: unknown = null;
    try {
      rawJson = await response.json();
    } catch {
      // Body is not JSON
    }

    if (rawJson) {
      const parsedEnvelope = ApiErrorEnvelopeSchema.safeParse(rawJson);
      if (parsedEnvelope.success) {
        throw new ApiError(
          response.status,
          parsedEnvelope.data.code,
          parsedEnvelope.data.message,
          parsedEnvelope.data.requestId,
          parsedEnvelope.data.fieldErrors,
          parsedEnvelope.data
        );
      }
    }

    // Fallback if error body does not match standard envelope
    throw new ApiError(
      response.status,
      `HTTP_${response.status}`,
      response.statusText || `Request failed with status ${response.status}`,
      `req_fallback_${Date.now()}`
    );
  }

  // Parse and validate success response
  let dataJson: unknown;
  try {
    dataJson = await response.json();
  } catch {
    throw new ApiError(
      502,
      'INVALID_JSON',
      'Failed to parse JSON response from server',
      `req_json_err_${Date.now()}`
    );
  }

  const validationResult = schema.safeParse(dataJson);
  if (!validationResult.success) {
    // FAIL CLOSED: Do not let untrusted malformed payload enter application state
    throw new ApiValidationError(validationResult.error);
  }

  return validationResult.data;
}
