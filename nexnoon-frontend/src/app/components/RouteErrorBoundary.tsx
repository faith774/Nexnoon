import { useEffect, useState } from 'react';
import { useNavigate, useRouteError, isRouteErrorResponse } from 'react-router';
import { AlertCircle, Home, RefreshCcw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

// Set right before an automatic reload, and never cleared: this caps auto-reload
// to once per browser tab session so a genuinely stale chunk can't reload forever.
const CHUNK_RELOAD_GUARD_KEY = 'nexnoon-chunk-reload-attempted';

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i.test(message);
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();
  const chunkError = isChunkLoadError(error);
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    if (!chunkError) return;
    let alreadyTried = false;
    try {
      alreadyTried = sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === '1';
      if (!alreadyTried) sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, '1');
    } catch {
      // sessionStorage unavailable (private browsing, etc.) - fall through to manual reload UI
      alreadyTried = true;
    }
    if (!alreadyTried) {
      setAutoReloading(true);
      window.location.reload();
    }
    // Intentionally only on first mount of this error state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const message = error instanceof Error
    ? error.message
    : isRouteErrorResponse(error)
      ? error.statusText
      : 'An unexpected error occurred.';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-gray-300 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-black mb-2">
          {chunkError ? 'Update available' : 'Oops! Something went wrong'}
        </h1>

        <p className="text-gray-600 mb-6">
          {autoReloading
            ? 'Loading the latest version...'
            : chunkError
              ? "This page's files were updated since it was last loaded. Refresh to get the latest version."
              : "We're sorry, but something unexpected happened. Please try refreshing the page."}
        </p>

        {!chunkError && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-xs text-gray-600 font-mono break-all">{message}</p>
          </div>
        )}

        {!autoReloading && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => window.location.reload()}
              className="flex-1 bg-black text-white hover:bg-gray-800 rounded-lg"
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh Page
            </Button>

            <Button
              variant="outline"
              className="flex-1 border-gray-300 rounded-lg"
              onClick={() => navigate('/')}
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
