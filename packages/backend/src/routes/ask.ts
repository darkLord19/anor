import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyJWT, type AuthenticatedRequest } from '../proxy/auth.js';
import { createUserClient, supabaseAdmin } from '../lib/supabase.js';
import { analyzeQuery, planGmailQuery } from '../lib/openai.js';
import { searchGmail } from '../lib/gmail.js';
import { getCalendarEvents, refreshAccessToken } from '../lib/calendar.js';
import { normalizeGmailResults, normalizeCalendarResults, mergeResults } from '../lib/normalizer.js';
import { synthesizeAnswer } from '../lib/synthesizer.js';
import { decryptTokens, encrypt } from '../lib/encryption.js';
import { getFeatureFlags, filterAnalysisByFlags, isExtensionEnabled } from '../lib/feature-flags.js';
import type { SearchHit, PendingSearch, DOMInstruction } from '../types/search.js';

const askRequestSchema = z.object({
  query: z.string().min(1).max(1000),
});

// In-memory store for pending searches (would use Redis in production)
const pendingSearches = new Map<string, PendingSearch>();

export async function askRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/ask', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;

    // Validate request body
    const parseResult = askRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const { query } = parseResult.data;
    const requestId = crypto.randomUUID();

    // Create user-scoped Supabase client
    const supabase = createUserClient(authRequest.accessToken);

    // Insert usage event (no query content stored - privacy first)
    const { error: insertError } = await supabase
      .from('usage_events')
      .insert([{
        user_id: authRequest.userId,
        event_type: 'ask',
      }]);

    if (insertError) {
      fastify.log.error(insertError, 'Failed to insert usage event');
    }

    // Get user's Google connection
    const { data: googleConnection, error: connectionError } = await supabase
      .from('connections')
      .select('*')
      .eq('user_id', authRequest.userId)
      .eq('type', 'google')
      .single();

    if (connectionError || !googleConnection) {
      return reply.code(400).send({
        error: 'Google account not connected',
        code: 'GOOGLE_NOT_CONNECTED',
      });
    }

    // Decrypt the stored tokens
    let decryptedTokens: { access_token: string; refresh_token: string };
    try {
      decryptedTokens = decryptTokens({
        access_token: googleConnection.access_token,
        refresh_token: googleConnection.refresh_token,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to decrypt tokens');
      return reply.code(500).send({
        error: 'Failed to decrypt stored tokens. Please reconnect your account.',
        code: 'DECRYPTION_FAILED',
      });
    }

    // Helper function to refresh and update Google token
    async function refreshAndUpdateToken(): Promise<string> {
      fastify.log.info('Refreshing Google access token');
      try {
        const newTokens = await refreshAccessToken(decryptedTokens.refresh_token);
        
        if (!newTokens.access_token) {
          throw new Error('No access token returned from refresh');
        }
        
        // Encrypt and update stored token (using admin client)
        if (supabaseAdmin) {
          const encryptedAccessToken = encrypt(newTokens.access_token);
          await supabaseAdmin
            .from('connections')
            .update({
              access_token: encryptedAccessToken,
              token_expires_at: new Date(newTokens.expiry_date || Date.now() + 3600000).toISOString(),
            })
            .eq('user_id', authRequest.userId)
            .eq('type', 'google');
        }
        
        return newTokens.access_token;
      } catch (error) {
        fastify.log.error(error, 'Failed to refresh Google token');
        throw error;
      }
    }

    // Check if token needs refresh
    let accessToken = decryptedTokens.access_token;
    const tokenExpiry = googleConnection.token_expires_at 
      ? new Date(googleConnection.token_expires_at) 
      : null;
    
    // Refresh if expired or if expiry is unknown (null)
    if (!tokenExpiry || tokenExpiry < new Date()) {
      try {
        accessToken = await refreshAndUpdateToken();
      } catch (error) {
        return reply.code(400).send({
          error: 'Failed to refresh Google token. Please reconnect your account.',
          code: 'TOKEN_REFRESH_FAILED',
        });
      }
    }

    try {
      // Step 0: Get feature flags for user
      const featureFlags = await getFeatureFlags(authRequest.userId);
      fastify.log.info({ featureFlags }, 'Feature flags loaded');

      // Step 1: Analyze query to determine which sources are needed
      fastify.log.info({ query }, 'Analyzing query');
      const rawAnalysis = await analyzeQuery(query);
      
      // Filter analysis based on feature flags (disable LinkedIn/WhatsApp if FF is off)
      const analysis = {
        ...rawAnalysis,
        ...filterAnalysisByFlags(rawAnalysis, featureFlags),
      };
      fastify.log.info({ analysis, filteredByFlags: !isExtensionEnabled(featureFlags) }, 'Query analysis complete');

      const results: SearchHit[] = [];
      const sourcesNeeded: string[] = [];
      const domInstructions: DOMInstruction[] = [];

      // Step 2: Fetch Gmail data if needed
      if (analysis.needsGmail) {
        sourcesNeeded.push('gmail');
        try {
          // Plan Gmail query
          const gmailPlan = await planGmailQuery(query);
          fastify.log.info({ gmailPlan }, 'Gmail query planned');

          // Execute Gmail search with retry on 401
          let gmailResults;
          const maxResults = gmailPlan.intent === 'summary' || gmailPlan.intent === 'count' ? 20 : 10;
          
          try {
            gmailResults = await searchGmail(
              accessToken,
              gmailPlan.gmailQuery,
              maxResults
            );
          } catch (error: any) {
            // If we get a 401, try refreshing the token and retry
            const isUnauthorized = error?.code === 401 || 
                                  error?.status === 401 || 
                                  error?.response?.status === 401 ||
                                  error?.response?.data?.error?.code === 401;
            
            if (isUnauthorized) {
              fastify.log.info('Gmail API returned 401, refreshing token and retrying');
              try {
                accessToken = await refreshAndUpdateToken();
                gmailResults = await searchGmail(
                  accessToken,
                  gmailPlan.gmailQuery,
                  maxResults
                );
              } catch (refreshError) {
                fastify.log.error(refreshError, 'Failed to refresh token after 401');
                throw refreshError;
              }
            } else {
              throw error;
            }
          }
          
          fastify.log.info({ count: gmailResults.messages.length }, 'Gmail search complete');
          results.push(...normalizeGmailResults(gmailResults.messages));
        } catch (error) {
          fastify.log.error(error, 'Gmail search failed');
        }
      }

      // Step 3: Fetch Calendar data if needed
      if (analysis.needsCalendar) {
        sourcesNeeded.push('calendar');
        try {
          const startDate = analysis.calendarDateRange?.start 
            ? new Date(analysis.calendarDateRange.start) 
            : undefined;
          const endDate = analysis.calendarDateRange?.end 
            ? new Date(analysis.calendarDateRange.end) 
            : undefined;

          let calendarResults;
          try {
            calendarResults = await getCalendarEvents(
              accessToken,
              startDate,
              endDate
            );
          } catch (error: any) {
            // If we get a 401, try refreshing the token and retry
            const isUnauthorized = error?.code === 401 || 
                                  error?.status === 401 || 
                                  error?.response?.status === 401 ||
                                  error?.response?.data?.error?.code === 401;
            
            if (isUnauthorized) {
              fastify.log.info('Calendar API returned 401, refreshing token and retrying');
              try {
                accessToken = await refreshAndUpdateToken();
                calendarResults = await getCalendarEvents(
                  accessToken,
                  startDate,
                  endDate
                );
              } catch (refreshError) {
                fastify.log.error(refreshError, 'Failed to refresh token after 401');
                throw refreshError;
              }
            } else {
              throw error;
            }
          }
          
          fastify.log.info({ count: calendarResults.events.length }, 'Calendar fetch complete');
          results.push(...normalizeCalendarResults(calendarResults.events));
        } catch (error) {
          fastify.log.error(error, 'Calendar fetch failed');
        }
      }

      // Step 4: Check if extension sources are needed (only if async mode is enabled)
      const needsExtension = featureFlags.enableAsyncMode && 
                            (analysis.needsLinkedIn || analysis.needsWhatsApp);
      
      if (analysis.needsLinkedIn && analysis.linkedInKeywords?.length) {
        sourcesNeeded.push('linkedin');
        domInstructions.push({
          request_id: requestId,
          source: 'linkedin',
          keywords: analysis.linkedInKeywords,
        });
      }
      
      if (analysis.needsWhatsApp && analysis.whatsAppKeywords?.length) {
        sourcesNeeded.push('whatsapp');
        domInstructions.push({
          request_id: requestId,
          source: 'whatsapp',
          keywords: analysis.whatsAppKeywords,
        });
      }

      // If async mode is disabled, skip extension and return sync response with Gmail/Calendar only
      if (!featureFlags.enableAsyncMode && (analysis.needsLinkedIn || analysis.needsWhatsApp)) {
        fastify.log.info('Async mode disabled - returning sync response with Gmail/Calendar only');
      }

      // If extension is needed AND async mode is enabled, store pending search and return early
      if (needsExtension) {
        const pendingSearch: PendingSearch = {
          request_id: requestId,
          user_id: authRequest.userId,
          query,
          requires_extension: true,
          sources_needed: sourcesNeeded as PendingSearch['sources_needed'],
          instructions: domInstructions,
          results: {
            gmail: results.filter(r => r.source === 'gmail'),
            calendar: results.filter(r => r.source === 'calendar'),
          },
          status: 'pending',
          created_at: new Date(),
        };
        
        pendingSearches.set(requestId, pendingSearch);
        
        // Clean up old pending searches (older than 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [id, search] of pendingSearches) {
          if (search.created_at.getTime() < fiveMinutesAgo) {
            pendingSearches.delete(id);
          }
        }

        return {
          status: 'pending',
          request_id: requestId,
          requires_extension: true,
          sources_needed: sourcesNeeded.filter(s => s === 'linkedin' || s === 'whatsapp'),
          instructions: domInstructions,
        };
      }

      // Step 5: Synthesize answer from results (sync response)
      // Filter sources to only include what was actually searched
      const actualSourcesSearched = sourcesNeeded.filter(s => s === 'gmail' || s === 'calendar');
      const mergedResults = mergeResults(results);
      fastify.log.info({ totalResults: mergedResults.length }, 'Synthesizing answer');
      
      const answer = await synthesizeAnswer(query, mergedResults);
      
      return {
        status: 'complete',
        request_id: requestId,
        answer,
        sources_searched: actualSourcesSearched,
      };

    } catch (error) {
      fastify.log.error(error, 'Ask processing failed');
      return reply.code(500).send({
        error: 'Failed to process query',
        request_id: requestId,
      });
    }
  });

  // Get pending search status
  fastify.get('/ask/:requestId', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const { requestId } = request.params as { requestId: string };

    const pendingSearch = pendingSearches.get(requestId);
    
    if (!pendingSearch) {
      return reply.code(404).send({ error: 'Search not found' });
    }
    
    if (pendingSearch.user_id !== authRequest.userId) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    const response: any = {
      status: pendingSearch.status,
      request_id: requestId,
      sources_needed: pendingSearch.sources_needed,
    };

    // Include answer if complete
    if (pendingSearch.status === 'complete' && pendingSearch.answer) {
      response.answer = pendingSearch.answer;
    }

    return response;
  });

  // Get pending search status (Legacy)
  fastify.get('/ask/:requestId/status', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const { requestId } = request.params as { requestId: string };

    const pendingSearch = pendingSearches.get(requestId);
    
    if (!pendingSearch) {
      return reply.code(404).send({ error: 'Search not found' });
    }
    
    if (pendingSearch.user_id !== authRequest.userId) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    const response: any = {
      status: pendingSearch.status,
      request_id: requestId,
      sources_needed: pendingSearch.sources_needed,
    };

    // Include answer if complete
    if (pendingSearch.status === 'complete' && pendingSearch.answer) {
      response.answer = pendingSearch.answer;
    }

    return response;
  });

  // Submit DOM results from extension
  fastify.post('/ask/:requestId/dom-results', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const { requestId } = request.params as { requestId: string };
    const { source, snippets } = request.body as { source: string; snippets: string[] };

    const pendingSearch = pendingSearches.get(requestId);
    
    if (!pendingSearch) {
      return reply.code(404).send({ error: 'Search not found' });
    }
    
    if (pendingSearch.user_id !== authRequest.userId) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    // Store DOM results
    const normalizedResults: SearchHit[] = snippets.map((snippet, index) => ({
      id: `${source}-${index}`,
      source: source as 'linkedin' | 'whatsapp',
      content: snippet,
      metadata: {},
      relevance: 0.9,
    }));

    pendingSearch.results[source] = normalizedResults;

    // Check if all sources are complete
    const allSourcesComplete = pendingSearch.sources_needed.every(
      src => pendingSearch.results[src] && pendingSearch.results[src]!.length >= 0
    );

    if (allSourcesComplete) {
      // Trigger synthesis in background
      (async () => {
        try {
          const allResults = mergeResults(...Object.values(pendingSearch.results).filter(Boolean) as SearchHit[][]);
          const answer = await synthesizeAnswer(pendingSearch.query, allResults);

          // Store answer before cleanup (keep for a short time for polling)
          pendingSearch.answer = answer;
          pendingSearch.status = 'complete';

          // Clean up after a delay to allow polling
          setTimeout(() => {
            pendingSearches.delete(requestId);
          }, 30000); // Keep for 30 seconds after completion
        } catch (error) {
          fastify.log.error(error, 'Background synthesis failed');
          pendingSearch.status = 'failed';
        }
      })();

      return {
        status: 'processing',
        request_id: requestId,
      };
    }

    pendingSearch.status = 'partial';
    return {
      status: 'partial',
      request_id: requestId,
    };
  });
}
