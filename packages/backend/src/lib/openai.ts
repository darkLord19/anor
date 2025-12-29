import OpenAI from 'openai';
import { z } from 'zod';
import { getGmailQueryPlanPrompt, getQueryAnalysisPrompt } from './prompts.js';

// Use OpenRouter with OpenAI SDK
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:3000',
    'X-Title': 'Dotor',
  },
});

// Default model - can be changed to any OpenRouter-supported model
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4-turbo-preview';

// Schema for Gmail query plan
export const GmailQueryPlanSchema = z.object({
  gmailQuery: z.string().describe('The optimized Gmail search query string'),
  intent: z.enum(['search', 'count', 'summary', 'meetings']).describe('The intent of the user query'),
  dateRange: z.object({
    days: z.number().nullable(),
  }).nullable(),
  filters: z.object({
    segments: z.array(z.string()),
    negatedSegments: z.array(z.string()),
    participants: z.array(z.string()).nullable(),
    keywords: z.array(z.string()).nullable(),
    hasAttachment: z.boolean().nullable(),
    labels: z.array(z.string()).nullable(),
    categories: z.array(z.string()).nullable(),
  }),
  explanation: z.string().describe('Brief explanation of the search strategy'),
});

export type GmailQueryPlan = z.infer<typeof GmailQueryPlanSchema>;

// Schema for determining required data sources
export const QueryAnalysisSchema = z.object({
  needsGmail: z.boolean(),
  needsCalendar: z.boolean(),
  needsLinkedIn: z.boolean(),
  needsWhatsApp: z.boolean(),
  gmailQuery: z.string().nullable().optional(), // Allow null when Gmail not needed
  calendarDateRange: z.object({
    start: z.string().optional(),
    end: z.string().optional(),
  }).nullable().optional(),
  linkedInKeywords: z.array(z.string()).nullable().optional(),
  whatsAppKeywords: z.array(z.string()).nullable().optional(),
});

export type QueryAnalysis = z.infer<typeof QueryAnalysisSchema>;

// Convert natural language to Gmail search query
export async function planGmailQuery(userQuery: string): Promise<GmailQueryPlan> {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: getGmailQueryPlanPrompt(),
      },
      {
        role: 'user',
        content: userQuery,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenRouter');
  }

  const parsed = JSON.parse(content);
  return GmailQueryPlanSchema.parse(parsed);
}

// Analyze user query to determine which data sources are needed
export async function analyzeQuery(userQuery: string): Promise<QueryAnalysis> {
  // Get today's date for context
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0] ?? ''; // YYYY-MM-DD format
  
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: getQueryAnalysisPrompt(todayStr),
      },
      {
        role: 'user',
        content: userQuery,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenRouter');
  }

  const parsed = JSON.parse(content);
  return QueryAnalysisSchema.parse(parsed);
}
