// API Constants
export const API_ROUTES = {
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    LOGOUT: '/auth/logout',
  },
  ASK: {
    BASE: '/ask',
    STATUS: (requestId: string) => `/ask/${requestId}`,
    DOM_RESULTS: (requestId: string) => `/ask/${requestId}/dom-results`,
  },
  GOOGLE: {
    CONNECT: '/google/connect',
    CALLBACK: '/google/callback',
    DISCONNECT: '/google/disconnect',
    STATUS: '/google/status',
  },
  ACCOUNT: {
    DELETE: '/account',
  },
  DOM: {
    INSTRUCTIONS: '/dom/instructions',
  },
  HEALTH: '/health',
} as const;

// Source Types
export const SOURCES = {
  GMAIL: 'gmail',
  CALENDAR: 'calendar',
  LINKEDIN: 'linkedin',
  WHATSAPP: 'whatsapp',
} as const;

// Error Codes
export const ERROR_CODES = {
  GOOGLE_NOT_CONNECTED: 'GOOGLE_NOT_CONNECTED',
  TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;
