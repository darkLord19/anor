import OpenAI from 'openai';
import { z } from 'zod';
import type { SearchHit } from '../types/search.js';
import { SYNTHESIZER_SYSTEM_PROMPT } from './prompts.js';

// Use OpenRouter with OpenAI SDK
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:3000',
    'X-Title': 'Dotor',
  },
});

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4-turbo-preview';

// Schema for synthesized answer
export const AnswerSchema = z.object({
  answer: z.string().describe('The synthesized answer to the user question'),
  citations: z.array(z.object({
    source: z.string(),
    content: z.string(),
    id: z.string(),
  })).describe('Sources cited in the answer'),
  confidence: z.number().min(0).max(100).describe('Confidence score 0-100'),
  insufficient: z.boolean().describe('Whether data was insufficient to answer'),
});

// Extended citation with link info (after processing)
export interface CitationWithLink {
  source: string;
  content: string;
  id: string;
  link?: string | undefined;
  messageId?: string | undefined;
  threadId?: string | undefined;
  eventId?: string | undefined;
  // Display metadata
  from?: string | undefined;
  subject?: string | undefined;
  date?: string | undefined;
}

export interface AnswerWithLinks {
  answer: string;
  citations: CitationWithLink[];
  confidence: number;
  insufficient: boolean;
}

export type Answer = z.infer<typeof AnswerSchema>;

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Synthesize an answer from search results
 * Uses only provided snippets - no hallucination
 */
export async function synthesizeAnswer(
  userQuery: string,
  results: SearchHit[],
  conversationHistory: Message[] = []
): Promise<AnswerWithLinks> {
  // Handle empty results
  if (results.length === 0) {
    // If we have conversation history, we might be able to answer from context even without new search results
    // But for now, let's keep the behavior consistent or maybe check if it's a pure chat query?
    // The prompt implies we are a search assistant, so if no results found for a query, we probably can't answer unless it's purely conversational.
    // However, if the user asks a follow up that doesn't need new search (e.g. "summarize that"), we might have results from previous turn?
    // But here we only get `results` passed in. The caller needs to decide if they want to pass previous results or if we re-search.
    // Assuming the caller handles search, if we get 0 results for a follow up, it might be bad.
    // But let's stick to the current logic: if no results, return insufficient, UNLESS we have history?
    // Actually, if it's a follow up, maybe the search returned nothing because the query was "and him?" which is hard to search.
    // The `analyzeQuery` should have handled converting "and him?" to a real query.
    // So if we are here with 0 results, it means the search failed.
    
    return {
      answer: 'I could not find any relevant information to answer your question.',
      citations: [],
      confidence: 0,
      insufficient: true,
    };
  }

  // Build a map of index to result for linking citations later
  const resultMap = new Map<number, SearchHit>();
  results.forEach((hit, index) => {
    resultMap.set(index + 1, hit); // 1-indexed for [1], [2], etc.
  });

  // Format results for the prompt
  const formattedResults = results.map((hit, index) => {
    const parts = [`[${index + 1}] Source: ${hit.source}`];
    if (hit.metadata.sender) parts.push(`From: ${hit.metadata.sender}`);
    if (hit.metadata.subject) parts.push(`Subject: ${hit.metadata.subject}`);
    if (hit.metadata.date) parts.push(`Date: ${hit.metadata.date}`);
    parts.push(`Content: ${hit.content}`);
    parts.push(`ID: ${hit.id}`);
    return parts.join('\n');
  }).join('\n\n');

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: SYNTHESIZER_SYSTEM_PROMPT + "\n\n=== CONVERSATION HISTORY ===\nUse the following conversation history to understand context for follow-up questions. If the user asks 'what about him?', refer to the person discussed in previous messages.",
    },
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    {
      role: 'user',
      content: `Question: ${userQuery}

Search Results:
${formattedResults}`,
    },
  ];

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      answer: 'Failed to generate an answer. Please try again.',
      citations: [],
      confidence: 0,
      insufficient: true,
    };
  }

  try {
    const parsed = JSON.parse(content);
    const rawAnswer = AnswerSchema.parse(parsed);
    
    // Enrich citations with link information
    const enrichedCitations: CitationWithLink[] = rawAnswer.citations.map(citation => {
      // Try to find the corresponding result by ID or by index
      let sourceHit: SearchHit | undefined;
      
      // First try to match by ID directly
      sourceHit = results.find(r => r.id === citation.id);
      
      // If not found, try to extract index from citation ID like "[1]" or "1"
      if (!sourceHit) {
        const indexMatch = citation.id.match(/\d+/);
        if (indexMatch) {
          const index = parseInt(indexMatch[0], 10);
          sourceHit = resultMap.get(index);
        }
      }
      
      // Build the enriched citation
      const enrichedCitation: CitationWithLink = {
        ...citation,
      };
      
      if (sourceHit) {
        // Add metadata for display
        enrichedCitation.from = sourceHit.metadata.sender;
        enrichedCitation.subject = sourceHit.metadata.subject;
        enrichedCitation.date = sourceHit.metadata.date;
        
        // Use the snippet as content if available
        if (sourceHit.content) {
          enrichedCitation.content = sourceHit.content;
        }
        
        // Add link based on source type
        if (sourceHit.source === 'gmail' && sourceHit.metadata.messageId) {
          enrichedCitation.messageId = sourceHit.metadata.messageId;
          enrichedCitation.threadId = sourceHit.metadata.threadId;
          // Gmail URL format: https://mail.google.com/mail/u/0/#inbox/MESSAGE_ID
          enrichedCitation.link = `https://mail.google.com/mail/u/0/#inbox/${sourceHit.metadata.messageId}`;
        } else if (sourceHit.source === 'calendar' && sourceHit.metadata.eventId) {
          enrichedCitation.eventId = sourceHit.metadata.eventId;
          // Google Calendar URL
          enrichedCitation.link = `https://calendar.google.com/calendar/u/0/r/eventedit/${sourceHit.metadata.eventId}`;
        }
        
        // Update the ID to be the actual message/event ID
        if (sourceHit.id) {
          enrichedCitation.id = sourceHit.id;
        }
      }
      
      return enrichedCitation;
    });
    
    return {
      answer: rawAnswer.answer,
      citations: enrichedCitations,
      confidence: rawAnswer.confidence,
      insufficient: rawAnswer.insufficient,
    };
  } catch {
    return {
      answer: content,
      citations: [],
      confidence: 50,
      insufficient: false,
    };
  }
}
