'use client';

import { useEffect } from 'react';

/**
 * Refreshes the short-lived access token before it expires. The refresh call
 * rotates the token server-side and rewrites both httpOnly cookies, so nothing
 * token-related is ever handled here. A failed refresh means the session was
 * revoked or expired: send the user back to sign in.
 */
export function SessionKeeper() {
  useEffect(() => {
    let cancelled = false;

    const refresh = async (): Promise<void> => {
      try {
        const response = await fetch('/api/session/refresh', { method: 'POST' });
        if (!cancelled && response.status === 401) {
          window.location.assign('/login?expired=1');
        }
      } catch {
        // Transient network failure: the next tick retries.
      }
    };

    // Access tokens are 15 minutes; refresh at 10 so a slip never hits a 401.
    const interval = window.setInterval(() => {
      void refresh();
    }, 10 * 60 * 1000);

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
