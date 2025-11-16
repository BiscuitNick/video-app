import { QueryErrorResetBoundary } from '@tanstack/react-query';
import ErrorBoundary from './ErrorBoundary';
import type { ReactNode } from 'react';

interface QueryErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Specialized error boundary for React Query errors
 * Provides reset functionality that clears the query cache
 */
export default function QueryErrorBoundary({ children }: QueryErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onError={(error) => {
            console.error('Query error caught:', error);
          }}
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
              <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                    <svg
                      className="w-8 h-8 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Failed to load data
                  </h2>
                  <p className="text-gray-600">
                    There was a problem loading the data. Please check your connection and try
                    again.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={reset}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium"
                  >
                    Retry
                  </button>
                  <button
                    onClick={() => (window.location.href = '/')}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors font-medium"
                  >
                    Go Home
                  </button>
                </div>
              </div>
            </div>
          }
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
