import type { Logger } from '@dotor/logger';
import type { DOMInstruction, SearchHit } from '../types/search.js';
import { NotFoundError, PermissionError } from '../lib/errors/index.js';

// In-memory store for pending requests (in production, use Redis)
export const pendingRequests = new Map<string, {
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

export interface DOMInstructionsRequest {
  request_id: string;
  sources: Array<'linkedin' | 'whatsapp'>;
  keywords: string[];
}

export interface DOMResultsRequest {
  request_id: string;
  source: string;
  snippets: string[];
  error?: string | undefined;
}

export class DOMService {
  constructor(_logger: Logger) {
    // Logger available for future use
  }

  createInstructions(userId: string, data: DOMInstructionsRequest) {
    const { request_id, sources, keywords } = data;

    // Create instructions for each source
    const instructions: DOMInstruction[] = sources.map(source => ({
      request_id,
      source,
      keywords,
    }));

    // Store pending request
    pendingRequests.set(request_id, {
      user_id: userId,
      instructions,
      results: new Map(),
      created_at: new Date(),
    });

    return {
      request_id,
      instructions,
    };
  }

  submitResults(userId: string, data: DOMResultsRequest) {
    const { request_id, source, snippets } = data;

    // Find pending request
    const pending = pendingRequests.get(request_id);
    if (!pending) {
      throw new NotFoundError('Request not found or expired');
    }

    // Verify ownership
    if (pending.user_id !== userId) {
      throw new PermissionError('Not authorized');
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
  }

  getResults(userId: string, requestId: string) {
    const pending = pendingRequests.get(requestId);
    if (!pending) {
      throw new NotFoundError('Request not found or expired');
    }

    if (pending.user_id !== userId) {
      throw new PermissionError('Not authorized');
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
      request_id: requestId,
      status: isComplete ? 'complete' : 'partial',
      results: allHits,
      received: receivedSources,
      expected: expectedSources,
    };
  }
}
