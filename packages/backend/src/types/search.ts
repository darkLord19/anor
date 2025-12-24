// Unified search result format
export interface SearchHit {
  id: string;
  source: 'gmail' | 'calendar' | 'linkedin' | 'whatsapp';
  content: string;
  metadata: {
    date?: string | undefined;
    sender?: string | undefined;
    subject?: string | undefined;
    attendees?: string[] | undefined;
  };
  relevance: number;
}

// DOM search instruction sent to extension
export interface DOMInstruction {
  request_id: string;
  source: 'linkedin' | 'whatsapp';
  keywords: string[];
}

// Response from extension
export interface DOMSearchResult {
  request_id: string;
  source: string;
  snippets: string[];
  error?: string | undefined;
}

// Pending search request (for polling)
export interface PendingSearch {
  request_id: string;
  user_id: string;
  query: string;
  requires_extension: boolean;
  sources_needed: ('gmail' | 'calendar' | 'linkedin' | 'whatsapp')[];
  instructions: DOMInstruction[];
  results: Partial<Record<string, SearchHit[]>>;
  status: 'pending' | 'partial' | 'complete' | 'failed';
  created_at: Date;
  answer?: Answer;
}

