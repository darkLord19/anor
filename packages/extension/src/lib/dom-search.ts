/**
 * Generic read-only DOM search engine
 * Never mutates the DOM
 */

export interface SearchResult {
  text: string;
  context: string;
  timestamp?: string;
  sender?: string;
}

export interface SearchOptions {
  maxResults?: number;
  includeContext?: boolean;
  contextLength?: number;
}

const DEFAULT_OPTIONS: Required<SearchOptions> = {
  maxResults: 50,
  includeContext: true,
  contextLength: 100,
};

/**
 * Search DOM for text matching keywords
 * Read-only operation - never modifies DOM
 */
export function searchDOM(
  keywords: string[],
  containerSelector: string,
  messageSelector: string,
  options: SearchOptions = {}
): SearchResult[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: SearchResult[] = [];
  
  // Normalize keywords for case-insensitive matching
  const normalizedKeywords = keywords.map(k => k.toLowerCase());
  
  // Find container element
  const container = document.querySelector(containerSelector);
  if (!container) {
    return [];
  }
  
  // Get all message elements
  const messages = Array.from(container.querySelectorAll(messageSelector));
  
  for (const message of messages) {
    if (results.length >= opts.maxResults) break;
    
    const text = message.textContent?.trim();
    if (!text) continue;
    
    const lowerText = text.toLowerCase();
    
    // Check if any keyword matches
    const hasMatch = normalizedKeywords.some(keyword => 
      lowerText.includes(keyword)
    );
    
    if (hasMatch) {
      results.push({
        text,
        context: opts.includeContext 
          ? getContext(message, opts.contextLength) 
          : '',
      });
    }
  }
  
  return results;
}

/**
 * Get surrounding context for a DOM element
 * Read-only operation
 */
function getContext(element: Element, maxLength: number): string {
  const parent = element.parentElement;
  if (!parent) return '';
  
  const siblings = Array.from(parent.children);
  const index = siblings.indexOf(element);
  
  const contextParts: string[] = [];
  
  // Get text from surrounding siblings
  for (let i = Math.max(0, index - 2); i <= Math.min(siblings.length - 1, index + 2); i++) {
    if (i !== index) {
      const text = siblings[i]?.textContent?.trim();
      if (text) {
        contextParts.push(text);
      }
    }
  }
  
  const context = contextParts.join(' ').substring(0, maxLength);
  return context;
}

/**
 * Extract text snippets matching keywords from a container
 * Minimal scrolling version - only reads visible content
 */
export function extractSnippets(
  keywords: string[],
  textSelector: string,
  maxSnippets: number = 20
): string[] {
  const snippets: string[] = [];
  const normalizedKeywords = keywords.map(k => k.toLowerCase());
  
  const elements = Array.from(document.querySelectorAll(textSelector));
  
  for (const element of elements) {
    if (snippets.length >= maxSnippets) break;
    
    const text = element.textContent?.trim();
    if (!text) continue;
    
    const lowerText = text.toLowerCase();
    
    for (const keyword of normalizedKeywords) {
      if (lowerText.includes(keyword)) {
        // Get snippet around the keyword
        const startIndex = Math.max(0, lowerText.indexOf(keyword) - 50);
        const endIndex = Math.min(text.length, lowerText.indexOf(keyword) + keyword.length + 50);
        
        let snippet = text.substring(startIndex, endIndex);
        if (startIndex > 0) snippet = '...' + snippet;
        if (endIndex < text.length) snippet = snippet + '...';
        
        if (!snippets.includes(snippet)) {
          snippets.push(snippet);
        }
        break;
      }
    }
  }
  
  return snippets;
}

