import { getAdminClient } from './client.js';

/**
 * Admin operations that bypass RLS
 * Use sparingly and only when necessary
 */

export async function updateGoogleConnectionTokens(
  userId: string,
  accessToken: string,
  tokenExpiresAt: string
): Promise<void> {
  const admin = getAdminClient();
  
  const { error } = await admin
    .from('connections')
    .update({
      access_token: accessToken,
      token_expires_at: tokenExpiresAt,
    })
    .eq('user_id', userId)
    .eq('type', 'google');

  if (error) {
    throw new Error(`Failed to update Google tokens: ${error.message}`);
  }
}
