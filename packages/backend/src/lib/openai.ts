import OpenAI from 'openai';
import { z } from 'zod';

// Use OpenRouter with OpenAI SDK
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL ?? 'http://localhost:3000',
    'X-Title': 'Anor',
  },
});

// Default model - can be changed to any OpenRouter-supported model
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-4-turbo-preview';

// Schema for Gmail query plan
export const GmailQueryPlanSchema = z.object({
  searchQuery: z.string().describe('Gmail search query string'),
  maxResults: z.number().min(1).max(50).default(10),
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
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const dateLimit = sixMonthsAgo.toISOString().split('T')[0]!.replace(/-/g, '/');

  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a Gmail search query planner. Convert natural language queries into Gmail search syntax.

IMPORTANT RULES:
1. ALWAYS include "after:${dateLimit}" to limit results to the past 6 months
2. Use Gmail search operators: from:, to:, subject:, has:attachment, is:unread, label:, etc.
3. Use quotes for exact phrases
4. Use OR for alternatives
5. Keep queries focused and specific

Respond with a JSON object containing:
- searchQuery: The Gmail search query string (MUST include after: constraint)
- maxResults: Suggested number of results (1-50)
- explanation: Brief explanation of the search strategy`,
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
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You analyze user questions to determine which data sources are needed.

Data sources available:
- Gmail: For email-related questions (messages, conversations, attachments)
- Calendar: For schedule, meetings, events
- LinkedIn: For professional messages, job-related conversations
- WhatsApp: For personal messages, chat conversations

Analyze the query and determine:
1. Which sources are needed (multiple can be true)
2. Search parameters for each source

Respond with a JSON object:
{
  "needsGmail": boolean,
  "needsCalendar": boolean,
  "needsLinkedIn": boolean,
  "needsWhatsApp": boolean,
  "gmailQuery": "optional Gmail search query",
  "calendarDateRange": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "linkedInKeywords": ["keyword1", "keyword2"],
  "whatsAppKeywords": ["keyword1", "keyword2"]
}`,
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
