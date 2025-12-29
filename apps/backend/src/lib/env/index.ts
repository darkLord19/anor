import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.string().default('info'),
  
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  
  // OpenRouter/LLM
  OPENROUTER_API_KEY: z.string(),
  OPENROUTER_MODEL: z.string().default('openai/gpt-4-turbo-preview'),
  
  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string().url(),
  
  // Security
  TOKEN_ENCRYPTION_SECRET: z.string().min(32),
  
  // App URLs
  APP_URL: z.string().url(),
  WEBAPP_URL: z.string().url(),
  
  // CORS
  CORS_ORIGIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getPort(): number {
  return parseInt(getEnv().PORT, 10);
}

export function getHost(): string {
  return getEnv().HOST;
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}
