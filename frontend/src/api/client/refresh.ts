import { refreshTokens } from './auth';

/**
 * Single-flight refresh coordinator.
 *
 * Both the axios 401 interceptor and AuthContext trigger a token refresh.
 * The backend rotates (consumes) refresh tokens, so two concurrent refreshes
 * with the same token race: one wins, the other 401s and is wrongly treated
 * as "session expired" (logout + cleared model selection). This module
 * collapses concurrent refreshes into ONE request and stores the rotated
 * refresh_token, so a refresh is never double-consumed.
 */
let refreshPromise: Promise<void> | null = null;

export function refreshAccessToken(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const rt = localStorage.getItem('agentstudio_refresh_token');
    if (!rt) throw new Error('no refresh token');
    const res = await refreshTokens(rt);
    // Access token lives in an httpOnly cookie (set by the server); persist the
    // rotated refresh_token so the next refresh/init uses the current one.
    localStorage.setItem('agentstudio_refresh_token', res.refresh_token);
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
