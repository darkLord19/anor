import { z } from 'zod';

// Auth Schemas
export const authLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const authSignupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// Ask Schemas
export const askRequestSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(1000, 'Query too long'),
});

export const domResultsSchema = z.object({
  source: z.enum(['linkedin', 'whatsapp']),
  snippets: z.array(z.string()),
});

// Export inferred types
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type AuthSignupInput = z.infer<typeof authSignupSchema>;
export type AskRequestInput = z.infer<typeof askRequestSchema>;
export type DOMResultsInput = z.infer<typeof domResultsSchema>;
