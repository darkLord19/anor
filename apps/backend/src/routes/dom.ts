import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyJWT, type AuthenticatedRequest } from '../proxy/auth.js';
import type { DOMInstruction, SearchHit } from '../types/search.js';

// In-memory store for pending requests (in production, use Redis)
const pendingRequests = new Map<string, {
  user_id: string;
  instructions: DOMInstruction[];
  results: Map<string, SearchHit[]>;
  created_at: Date;
}>();

// Cleanup old requests every 5 minutes
setInterval(() => {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  for (const [id, request] of pendingRequests) {
    if (request.created_at < fiveMinutesAgo) {
      pendingRequests.delete(id);
    }
  }
}, 5 * 60 * 1000);

const createInstructionsSchema = z.object({
  request_id: z.string().uuid(),
  sources: z.array(z.enum(['linkedin', 'whatsapp'])),
  keywords: z.array(z.string()),
});

const submitResultsSchema = z.object({
  request_id: z.string().uuid(),
  source: z.string(),
  snippets: z.array(z.string()),
  error: z.string().optional(),
});

export async function domRoutes(fastify: FastifyInstance): Promise<void> {
  // Get DOM instructions for a request
  fastify.post('/dom/instructions', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    
    const parseResult = createInstructionsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const { request_id, sources, keywords } = parseResult.data;

    // Create instructions for each source
    const instructions: DOMInstruction[] = sources.map(source => ({
      request_id,
      source,
      keywords,
    }));

    // Store pending request
    pendingRequests.set(request_id, {
      user_id: authRequest.userId,
      instructions,
      results: new Map(),
      created_at: new Date(),
    });

    return {
      request_id,
      instructions,
    };
  });

  // Extension submits DOM search results
  fastify.post('/dom/results', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    
    const parseResult = submitResultsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.code(400).send({
        error: 'Invalid request body',
        details: parseResult.error.issues,
      });
    }

    const { request_id, source, snippets } = parseResult.data;

    // Find pending request
    const pending = pendingRequests.get(request_id);
    if (!pending) {
      return reply.code(404).send({ error: 'Request not found or expired' });
    }

    // Verify ownership
    if (pending.user_id !== authRequest.userId) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    // Convert snippets to SearchHits
    const hits: SearchHit[] = snippets.map((snippet, index) => ({
      id: `${request_id}-${source}-${index}`,
      source: source as 'linkedin' | 'whatsapp',
      content: snippet,
      metadata: {},
      relevance: 1.0,
    }));

    // Store results
    pending.results.set(source, hits);

    // Check if all results are in
    const expectedSources = pending.instructions.map(i => i.source);
    const receivedSources = Array.from(pending.results.keys());
    const isComplete = expectedSources.every(s => receivedSources.includes(s));

    return {
      request_id,
      status: isComplete ? 'complete' : 'partial',
      received: receivedSources,
      expected: expectedSources,
    };
  });

  // Poll for results
  fastify.get('/dom/results/:request_id', {
    preHandler: verifyJWT,
  }, async (request, reply) => {
    const authRequest = request as AuthenticatedRequest;
    const { request_id } = request.params as { request_id: string };

    const pending = pendingRequests.get(request_id);
    if (!pending) {
      return reply.code(404).send({ error: 'Request not found or expired' });
    }

    if (pending.user_id !== authRequest.userId) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    // Collect all results
    const allHits: SearchHit[] = [];
    for (const hits of pending.results.values()) {
      allHits.push(...hits);
    }

    const expectedSources = pending.instructions.map(i => i.source);
    const receivedSources = Array.from(pending.results.keys());
    const isComplete = expectedSources.every(s => receivedSources.includes(s));

    return {
      request_id,
      status: isComplete ? 'complete' : 'partial',
      results: allHits,
      received: receivedSources,
      expected: expectedSources,
    };
  });
}

