import { AuthUser } from './schemas';

/**
 * API configuration and tenant context store.
 * Ensures tenant context is injected exclusively via headers and cannot be spoofed via URL or body.
 */

export interface ApiConfig {
  baseUrl: string;
  tenantId: string | null;
  authToken: string | null;
  user: AuthUser | null;
}

const SESSION_STORAGE_KEY = 'srcc_auth_session';

function loadStoredSession(): { tenantId: string | null; authToken: string | null; user: AuthUser | null } {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return { tenantId: null, authToken: null, user: null };
  }
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return { tenantId: null, authToken: null, user: null };
    const parsed = JSON.parse(raw);
    return {
      tenantId: parsed.tenantId || null,
      authToken: parsed.authToken || null,
      user: parsed.user || null
    };
  } catch {
    return { tenantId: null, authToken: null, user: null };
  }
}

function persistSession(session: { tenantId: string | null; authToken: string | null; user: AuthUser | null }) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    if (session.authToken && session.tenantId) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota/permission issues
  }
}

const initialSession = loadStoredSession();

const config: ApiConfig = {
  baseUrl: '',
  tenantId: initialSession.tenantId,
  authToken: initialSession.authToken,
  user: initialSession.user
};

let currentSnapshot: Readonly<ApiConfig> = Object.freeze({
  baseUrl: '',
  tenantId: initialSession.tenantId,
  authToken: initialSession.authToken,
  user: initialSession.user
});

export type ApiConfigListener = (config: Readonly<ApiConfig>) => void;
const listeners = new Set<ApiConfigListener>();

const notifyListeners = (): void => {
  currentSnapshot = Object.freeze({ ...config });
  persistSession({
    tenantId: config.tenantId,
    authToken: config.authToken,
    user: config.user
  });
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
  if (newConfig.user !== undefined && config.user !== newConfig.user) {
    config.user = newConfig.user;
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
  config.user = null;
  notifyListeners();
};
