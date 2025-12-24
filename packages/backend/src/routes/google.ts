import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyJWT, type AuthenticatedRequest } from '../middleware/auth.js';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import { getGoogleAuthUrl, exchangeCodeForTokens } from '../lib/calendar.js';
import { encryptTokens } from '../lib/encryption.js';
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const callbackSchema = z.object({
  code: z.string(),
  state: z.string(),
});

export async function googleRoutes(fastify: FastifyInstance): Promise<void> {
  // Get Google connection status
  fastify.get('/google/status', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const supabase = createUserClient(authRequest.accessToken);

    const { data, error } = await supabase
      .from('google_connections')
      .select('google_email, scopes, created_at, token_expires_at')
      .eq('user_id', authRequest.userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      fastify.log.error(error, 'Failed to fetch google connection');
      return reply.code(500).send({ error: 'Failed to fetch connection status' });
    }

    if (!data) {
      return { connected: false };
    }

    // Check if token is expired
    const isExpired = new Date(data.token_expires_at) < new Date();

    return {
      connected: true,
      email: data.google_email,
      scopes: data.scopes,
      connectedAt: data.created_at,
      needsRefresh: isExpired,
    };
  });

  // Get auth URL to connect Google account
  fastify.get('/google/auth-url', {
    preHandler: verifyJWT,
  }, async (request) => {
    const authRequest = request as AuthenticatedRequest;
    
    // Use user ID as state for verification
    const state = Buffer.from(JSON.stringify({
      userId: authRequest.userId,
      timestamp: Date.now(),
    })).toString('base64');

    const authUrl = getGoogleAuthUrl(state);

    return { url: authUrl };
  });

  // Handle OAuth callback
  fastify.get('/google/callback', async (request, reply) => {
    const parseResult = callbackSchema.safeParse(request.query);
    
    if (!parseResult.success) {
      return reply.code(400).send({ error: 'Invalid callback parameters' });
    }

    const { code, state } = parseResult.data;

    // Decode and verify state
    let stateData: { userId: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
    } catch {
      return reply.code(400).send({ error: 'Invalid state parameter' });
    }

    // Check state is not too old (5 minutes max)
    if (Date.now() - stateData.timestamp > 5 * 60 * 1000) {
      return reply.code(400).send({ error: 'State expired' });
    }

    if (!supabaseAdmin) {
      fastify.log.error('Supabase admin client not configured');
      return reply.code(500).send({ error: 'Server configuration error' });
    }

    try {
      // Exchange code for tokens
      const tokens = await exchangeCodeForTokens(code);

      if (!tokens.access_token || !tokens.refresh_token) {
        return reply.code(400).send({ error: 'Failed to get tokens from Google' });
      }

      // Get user's Google email
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: tokens.access_token });
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const googleEmail = userInfo.data.email;

      if (!googleEmail) {
        return reply.code(400).send({ error: 'Could not get Google email' });
      }

      // Calculate expiry time
      const expiresAt = new Date(Date.now() + (tokens.expiry_date || 3600 * 1000));

      // Encrypt tokens before storing
      const encryptedTokens = encryptTokens({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });

      // Upsert the connection (using admin client since user isn't authenticated here)
      const { error: upsertError } = await supabaseAdmin
        .from('google_connections')
        .upsert({
          user_id: stateData.userId,
          google_email: googleEmail,
          access_token: encryptedTokens.access_token,
          refresh_token: encryptedTokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          scopes: SCOPES,
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        fastify.log.error(upsertError, 'Failed to save google connection');
        return reply.code(500).send({ error: 'Failed to save connection' });
      }

      // Redirect back to the app
      const redirectUrl = process.env.WEBAPP_URL || 'http://localhost:3000';
      return reply.redirect(`${redirectUrl}/ask?google_connected=true`);
    } catch (error) {
      fastify.log.error(error, 'Google OAuth callback error');
      const redirectUrl = process.env.WEBAPP_URL || 'http://localhost:3000';
      return reply.redirect(`${redirectUrl}/ask?google_error=true`);
    }
  });

  // Disconnect Google account
  fastify.delete('/google/disconnect', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const supabase = createUserClient(authRequest.accessToken);

    const { error } = await supabase
      .from('google_connections')
      .delete()
      .eq('user_id', authRequest.userId);

    if (error) {
      fastify.log.error(error, 'Failed to disconnect google');
      return reply.code(500).send({ error: 'Failed to disconnect' });
    }

    return { success: true };
  });
}

