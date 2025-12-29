import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  description?: string | undefined;
}

export interface CalendarSearchResult {
  events: CalendarEvent[];
}

export async function getCalendarEvents(
  accessToken: string,
  timeMin?: Date,
  timeMax?: Date,
  maxResults: number = 20
): Promise<CalendarSearchResult> {
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  
  // Default to events from the past week to next week
  const defaultTimeMin = new Date();
  defaultTimeMin.setDate(defaultTimeMin.getDate() - 7);
  
  const defaultTimeMax = new Date();
  defaultTimeMax.setDate(defaultTimeMax.getDate() + 7);
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: (timeMin ?? defaultTimeMin).toISOString(),
    timeMax: (timeMax ?? defaultTimeMax).toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  
  const events = response.data.items ?? [];
  
  return {
    events: events.map((event): CalendarEvent => ({
      id: event.id ?? '',
      title: event.summary ?? 'No title',
      start: event.start?.dateTime ?? event.start?.date ?? '',
      end: event.end?.dateTime ?? event.end?.date ?? '',
      attendees: (event.attendees ?? [])
        .map(a => a.email)
        .filter((email): email is string => Boolean(email)),
      description: event.description ?? undefined,
    })),
  };
}

// Get Calendar auth URL for OAuth flow  
export function getCalendarAuthUrl(state: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    state,
    prompt: 'consent',
  });
}

// Combined auth URL for both Gmail and Calendar
export function getGoogleAuthUrl(state: string): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
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
  const response = await oauth2Client.getToken(code);
  console.log('[CALENDAR] getToken response:', {
    hasTokens: !!response.tokens,
    tokenKeys: response.tokens ? Object.keys(response.tokens) : [],
    hasAccessToken: !!response.tokens?.access_token,
    hasRefreshToken: !!response.tokens?.refresh_token,
  });
  return response.tokens;
}

// Refresh access token using refresh token
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string | null;
  expiry_date: number | null;
}> {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return {
    access_token: credentials.access_token ?? null,
    expiry_date: credentials.expiry_date ?? null,
  };
}

