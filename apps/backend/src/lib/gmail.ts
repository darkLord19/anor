import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export interface GmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
}

export interface GmailSearchResult {
  messages: GmailMessage[];
  nextPageToken?: string | undefined;
}

// Calculate date 6 months ago for query cap
function getSixMonthsAgo(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().split('T')[0]!.replace(/-/g, '/');
}

// Enforce 6-month cap on Gmail queries
function enforceQueryDateCap(query: string): string {
  const sixMonthsAgo = getSixMonthsAgo();
  
  // If query already has an after: or newer_than: clause, don't modify it
  if (query.includes('after:') || query.includes('newer_than:')) {
    return query;
  }
  
  // Add 6-month cap to query
  return `${query} after:${sixMonthsAgo}`;
}

export async function searchGmail(
  accessToken: string,
  query: string,
  maxResults: number = 10
): Promise<GmailSearchResult> {
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // Enforce 6-month date cap
  const cappedQuery = enforceQueryDateCap(query);
  
  // Search for messages
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    q: cappedQuery,
    maxResults,
  });
  
  const messageIds = listResponse.data.messages ?? [];
  
  if (messageIds.length === 0) {
    return { messages: [] };
  }
  
  // Fetch message details (metadata and snippet only)
  const messages = await Promise.all(
    messageIds.map(async (msg): Promise<GmailMessage | null> => {
      if (!msg.id) return null;
      
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      });
      
      const headers = detail.data.payload?.headers ?? [];
      const getHeader = (name: string) => 
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
      
      return {
        id: msg.id,
        threadId: msg.threadId ?? '',
        snippet: detail.data.snippet ?? '',
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        date: getHeader('Date'),
      };
    })
  );
  
  return {
    messages: messages.filter((m): m is GmailMessage => m !== null),
    nextPageToken: listResponse.data.nextPageToken ?? undefined,
  };
}

// Get Gmail auth URL for OAuth flow
export function getGmailAuthUrl(state: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
    state,
    prompt: 'consent',
  });
}

// Exchange auth code for tokens
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
}> {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

