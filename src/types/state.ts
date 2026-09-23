/**
 * Discriminated union state modeling for query and mutation hooks.
 * Prevents impossible states (e.g. loading=true AND error set simultaneously).
 */

import { ApiError } from '../api/client';

export type QueryState<T> =
  | { readonly status: 'idle'; readonly data: null; readonly error: null }
  | { readonly status: 'loading'; readonly data: null; readonly error: null }
  | { readonly status: 'refreshing'; readonly data: T; readonly error: null }
  | { readonly status: 'success'; readonly data: T; readonly error: null }
  | { readonly status: 'error'; readonly data: null; readonly error: ApiError };

export type MutationState<T> =
  | { readonly status: 'idle'; readonly data: null; readonly error: null }
  | { readonly status: 'loading'; readonly data: null; readonly error: null }
  | { readonly status: 'success'; readonly data: T; readonly error: null }
  | { readonly status: 'error'; readonly data: null; readonly error: ApiError }
  | {
      readonly status: 'conflict';
      readonly data: null;
      readonly error: ApiError;
      readonly currentVersion?: number;
      readonly message: string;
    };
