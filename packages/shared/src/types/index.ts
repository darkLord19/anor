// API Request/Response DTOs

export interface AskRequest {
  query: string;
}

export interface AskResponse {
  status: 'complete' | 'pending';
  request_id: string;
  answer?: {
    text: string;
    confidence: number;
    sources: Array<{
      id: string;
      source: string;
      title?: string;
      snippet: string;
      relevance: number;
    }>;
  };
  sources_searched?: string[];
  requires_extension?: boolean;
  sources_needed?: string[];
  instructions?: DOMInstruction[];
}

export interface AskStatusResponse {
  status: 'pending' | 'partial' | 'complete' | 'failed';
  request_id: string;
  sources_needed: string[];
  answer?: {
    text: string;
    confidence: number;
    sources: Array<{
      id: string;
      source: string;
      title?: string;
      snippet: string;
      relevance: number;
    }>;
  };
}

export interface DOMInstruction {
  request_id: string;
  source: string;
  keywords: string[];
}

export interface DOMResultsRequest {
  source: string;
  snippets: string[];
}

export interface DOMResultsResponse {
  status: 'partial' | 'processing';
  request_id: string;
}

export interface GoogleAuthUrlResponse {
  url: string;
}

export interface GoogleConnectionStatus {
  connected: boolean;
  email?: string;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthSignupRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
  user: {
    id: string;
    email: string;
  };
}

export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

// Domain Types
export type SourceType = 'gmail' | 'calendar' | 'linkedin' | 'whatsapp';

export interface SearchHit {
  id: string;
  source: SourceType;
  content: string;
  metadata: Record<string, unknown>;
  relevance: number;
  title?: string;
}
