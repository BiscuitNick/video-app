import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { env } from '../config/env';

/**
 * API Error type
 */
export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: unknown;
}

/**
 * Create and configure the Axios instance
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: env.apiBaseUrl,
    timeout: env.apiTimeout,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  /**
   * Request interceptor
   * Add auth token and other headers before sending requests
   */
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Add auth token if available
      const token = localStorage.getItem('auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Log request in debug mode
      if (env.enableDebug) {
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data,
        });
      }

      return config;
    },
    (error: AxiosError) => {
      if (env.enableDebug) {
        console.error('[API Request Error]', error);
      }
      return Promise.reject(error);
    }
  );

  /**
   * Response interceptor
   * Handle responses and errors globally
   */
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Log response in debug mode
      if (env.enableDebug) {
        console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          data: response.data,
        });
      }

      return response;
    },
    (error: AxiosError<ApiError>) => {
      // Handle specific error cases
      if (error.response) {
        const { status, data } = error.response;

        // Handle authentication errors
        if (status === 401) {
          // Clear auth token
          localStorage.removeItem('auth_token');

          // Redirect to login or show auth modal
          // This can be customized based on your auth flow
          if (env.enableDebug) {
            console.error('[API] Unauthorized - clearing auth token');
          }
        }

        // Handle forbidden errors
        if (status === 403) {
          if (env.enableDebug) {
            console.error('[API] Forbidden - insufficient permissions');
          }
        }

        // Handle server errors
        if (status >= 500) {
          if (env.enableDebug) {
            console.error('[API] Server error:', data);
          }
        }

        // Log error in debug mode
        if (env.enableDebug) {
          console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
            status,
            message: data?.message || error.message,
            details: data?.details,
          });
        }

        // Return standardized error
        return Promise.reject({
          message: data?.message || 'An error occurred',
          status,
          code: data?.code,
          details: data?.details,
        } as ApiError);
      }

      // Handle network errors
      if (error.request) {
        if (env.enableDebug) {
          console.error('[API] Network error - no response received', error.request);
        }
        return Promise.reject({
          message: 'Network error - please check your connection',
          code: 'NETWORK_ERROR',
        } as ApiError);
      }

      // Handle other errors
      if (env.enableDebug) {
        console.error('[API] Unexpected error', error);
      }
      return Promise.reject({
        message: error.message || 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
      } as ApiError);
    }
  );

  return client;
};

// Export singleton instance
export const apiClient = createApiClient();

// Export helper function to update auth token
export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

// Export helper to clear auth
export const clearAuth = () => {
  localStorage.removeItem('auth_token');
};

export default apiClient;
