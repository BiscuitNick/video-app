/**
 * Environment configuration
 * All environment variables must be prefixed with VITE_ to be exposed
 */

interface EnvConfig {
  apiBaseUrl: string;
  apiTimeout: number;
  appEnv: string;
  enableDebug: boolean;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = import.meta.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value ?? defaultValue;
};

export const env: EnvConfig = {
  apiBaseUrl: getEnvVar('VITE_API_BASE_URL', 'http://localhost:8000'),
  apiTimeout: parseInt(getEnvVar('VITE_API_TIMEOUT', '30000'), 10),
  appEnv: getEnvVar('VITE_APP_ENV', 'development'),
  enableDebug: getEnvVar('VITE_ENABLE_DEBUG', 'false') === 'true',
};

export default env;
