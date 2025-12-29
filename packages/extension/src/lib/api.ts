import { getAccessToken } from './session.js';

// API base URL from environment
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

interface DOMInstruction {
  request_id: string;
  source: 'linkedin' | 'whatsapp';
  keywords: string[];
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAccessToken();
  
  if (!token) {
    return { error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error ?? 'Request failed' };
    }

    return { data };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Request failed' };
  }
}

export async function login(email: string, password: string) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    return data;
  } catch (error) {
    throw error;
  }
}

export async function signup(email: string, password: string) {
  try {
    const response = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Signup failed');
    return data;
  } catch (error) {
    throw error;
  }
}

export async function getGoogleStatus() {
  return fetchWithAuth<{ connected: boolean; email?: string }>('/google/status');
}

// Get DOM search instructions from backend
export async function getInstructions(
  requestId: string,
  sources: ('linkedin' | 'whatsapp')[],
  keywords: string[]
): Promise<ApiResponse<{ instructions: DOMInstruction[] }>> {
  return fetchWithAuth('/dom/instructions', {
    method: 'POST',
    body: JSON.stringify({
      request_id: requestId,
      sources,
      keywords,
    }),
  });
}

// Submit DOM search results to backend (for ask endpoint)
export async function submitAskResults(
  requestId: string,
  source: string,
  snippets: string[],
  error?: string
): Promise<ApiResponse<{ status: string }>> {
  return fetchWithAuth(`/ask/${requestId}/dom-results`, {
    method: 'POST',
    body: JSON.stringify({
      source,
      snippets,
      error,
    }),
  });
}

// Submit DOM search results to backend (for dom endpoint - legacy)
export async function submitResults(
  requestId: string,
  source: string,
  snippets: string[],
  error?: string
): Promise<ApiResponse<{ status: string }>> {
  return fetchWithAuth('/dom/results', {
    method: 'POST',
    body: JSON.stringify({
      request_id: requestId,
      source,
      snippets,
      error,
    }),
  });
}

// Execute DOM instructions in parallel
export async function executeDOMInstructions(
  instructions: DOMInstruction[],
  useAskEndpoint = true
): Promise<Map<string, string[]>> {
  const results = new Map<string, string[]>();

  if (instructions.length === 0) {
    return results;
  }

  // Get the request_id from the first instruction (all should have the same request_id)
  const requestId = instructions[0]!.request_id;

  // Execute all instructions in parallel
  await Promise.all(
    instructions.map(async (instruction) => {
      try {
        console.log(`[Dotor API] Executing instruction for ${instruction.source} with keywords:`, instruction.keywords);
        
        const response = await chrome.runtime.sendMessage({
          type: 'DOM_SEARCH',
          payload: {
            request_id: instruction.request_id,
            keywords: instruction.keywords,
            source: instruction.source,
          },
        });

        const snippets = response.snippets ?? [];
        const error = response.error;
        
        console.log(`[Dotor API] Search completed for ${instruction.source}: ${snippets.length} snippets${error ? `, error: ${error}` : ''}`);
        
        results.set(instruction.source, snippets);

        // Submit results to backend (use ask endpoint by default)
        if (useAskEndpoint) {
          const submitResult = await submitAskResults(
            requestId,
            instruction.source,
            snippets,
            error
          );
          
          if (submitResult.error) {
            console.error(`[Dotor API] Failed to submit results for ${instruction.source}:`, submitResult.error);
          } else {
            console.log(`[Dotor API] Results submitted successfully for ${instruction.source}`);
          }
        } else {
          const submitResult = await submitResults(
            requestId,
            instruction.source,
            snippets,
            error
          );
          
          if (submitResult.error) {
            console.error(`[Dotor API] Failed to submit results for ${instruction.source}:`, submitResult.error);
          }
        }
      } catch (error) {
        console.error(`[Dotor API] Error executing instruction for ${instruction.source}:`, error);
        results.set(instruction.source, []);
        
        // Submit error to backend
        const errorMessage = error instanceof Error ? error.message : 'Execution failed';
        if (useAskEndpoint) {
          await submitAskResults(
            requestId,
            instruction.source,
            [],
            errorMessage
          );
        } else {
          await submitResults(
            requestId,
            instruction.source,
            [],
            errorMessage
          );
        }
      }
    })
  );

  return results;
}
