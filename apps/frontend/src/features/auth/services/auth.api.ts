import { httpClient } from '@/services/http/client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/** Full URL of the backend endpoint that initiates the Google OAuth flow. */
export function getGoogleLoginUrl(): string {
  return `${API_URL}/auth/google`;
}

/** Revokes every token the server has issued to the current user. */
export async function logout(): Promise<void> {
  await httpClient.post('/auth/logout');
}
