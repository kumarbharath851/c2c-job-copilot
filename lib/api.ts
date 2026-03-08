/**
 * Central API fetch utility.
 * Automatically attaches the x-user-id header required by all API routes.
 * In a production app this would come from the auth session.
 */
const DEMO_USER_ID = 'demo-user';

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      'x-user-id': DEMO_USER_ID,
      ...init?.headers,
    },
  });
}
