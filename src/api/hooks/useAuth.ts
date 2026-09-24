import { useSyncExternalStore } from 'react';
import { subscribeApiConfig, getApiConfig, ApiConfig } from '../config';
import { AuthUser } from '../schemas';

export interface AuthState {
  isAuthenticated: boolean;
  tenantId: string | null;
  authToken: string | null;
  baseUrl: string;
  user: AuthUser | null;
}

/**
 * Reactive auth/tenant session hook.
 * Uses useSyncExternalStore to subscribe to external ApiConfig singleton,
 * completely avoiding stale closures or missed synchronous state transitions.
 */
export function useAuth(): AuthState {
  const config = useSyncExternalStore<Readonly<ApiConfig>>(
    subscribeApiConfig,
    getApiConfig,
    getApiConfig
  );

  return {
    isAuthenticated: Boolean(config.authToken),
    tenantId: config.tenantId,
    authToken: config.authToken,
    baseUrl: config.baseUrl,
    user: config.user
  };
}
