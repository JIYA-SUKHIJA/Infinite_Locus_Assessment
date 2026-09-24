/**
 * API configuration and tenant context store.
 * Ensures tenant context is injected exclusively via headers and cannot be spoofed via URL or body.
 */

export interface ApiConfig {
  baseUrl: string;
  tenantId: string | null;
  authToken: string | null;
}

const config: ApiConfig = {
  baseUrl: '',
  tenantId: null,
  authToken: null
};

let currentSnapshot: Readonly<ApiConfig> = Object.freeze({
  baseUrl: '',
  tenantId: null,
  authToken: null
});

export type ApiConfigListener = (config: Readonly<ApiConfig>) => void;
const listeners = new Set<ApiConfigListener>();

const notifyListeners = (): void => {
  currentSnapshot = Object.freeze({ ...config });
  listeners.forEach((listener) => {
    try {
      listener(currentSnapshot);
    } catch (e) {
      console.error('Error in ApiConfig listener:', e);
    }
  });
};

export const subscribeApiConfig = (listener: ApiConfigListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setApiConfig = (newConfig: Partial<ApiConfig>): void => {
  let changed = false;
  if (newConfig.baseUrl !== undefined) {
    const formatted = newConfig.baseUrl.replace(/\/+$/, '');
    if (config.baseUrl !== formatted) {
      config.baseUrl = formatted;
      changed = true;
    }
  }
  if (newConfig.tenantId !== undefined && config.tenantId !== newConfig.tenantId) {
    config.tenantId = newConfig.tenantId;
    changed = true;
  }
  if (newConfig.authToken !== undefined && config.authToken !== newConfig.authToken) {
    config.authToken = newConfig.authToken;
    changed = true;
  }

  if (changed) {
    notifyListeners();
  }
};

export const getApiConfig = (): Readonly<ApiConfig> => {
  return currentSnapshot;
};

export const resetApiConfig = (): void => {
  config.baseUrl = '';
  config.tenantId = null;
  config.authToken = null;
  notifyListeners();
};
