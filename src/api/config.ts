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

export const setApiConfig = (newConfig: Partial<ApiConfig>): void => {
  if (newConfig.baseUrl !== undefined) config.baseUrl = newConfig.baseUrl.replace(/\/+$/, '');
  if (newConfig.tenantId !== undefined) config.tenantId = newConfig.tenantId;
  if (newConfig.authToken !== undefined) config.authToken = newConfig.authToken;
};

export const getApiConfig = (): Readonly<ApiConfig> => {
  return config;
};

export const resetApiConfig = (): void => {
  config.baseUrl = '';
  config.tenantId = null;
  config.authToken = null;
};
