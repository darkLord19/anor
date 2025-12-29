/**
 * Feature Flag System
 * Controls availability of LinkedIn/WhatsApp extension-based features
 */

import { supabaseAdmin } from './supabase.js';

export interface FeatureFlags {
  // Extension-based sources
  enableLinkedIn: boolean;
  enableWhatsApp: boolean;
  
  // Response mode: sync (Gmail only) vs async (with extension)
  enableAsyncMode: boolean;
}

// Default flags (fallback when DB unavailable)
const DEFAULT_FLAGS: FeatureFlags = {
  enableLinkedIn: false,
  enableWhatsApp: false,
  enableAsyncMode: false,
};

// Environment variable overrides (highest priority)
function getEnvFlags(): Partial<FeatureFlags> {
  const flags: Partial<FeatureFlags> = {};
  
  if (process.env.FF_ENABLE_LINKEDIN !== undefined) {
    flags.enableLinkedIn = process.env.FF_ENABLE_LINKEDIN === 'true';
  }
  if (process.env.FF_ENABLE_WHATSAPP !== undefined) {
    flags.enableWhatsApp = process.env.FF_ENABLE_WHATSAPP === 'true';
  }
  if (process.env.FF_ENABLE_ASYNC_MODE !== undefined) {
    flags.enableAsyncMode = process.env.FF_ENABLE_ASYNC_MODE === 'true';
  }
  
  return flags;
}

// Cache for feature flags
let cachedFlags: FeatureFlags | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get feature flags for a user
 * Priority: Environment vars > Database (user-specific) > Database (global) > Defaults
 */
export async function getFeatureFlags(userId?: string): Promise<FeatureFlags> {
  // Start with defaults
  let flags = { ...DEFAULT_FLAGS };
  
  // Try to get from database if admin client is available
  if (supabaseAdmin) {
    try {
      // Check cache first
      const now = Date.now();
      if (cachedFlags && (now - cacheTimestamp) < CACHE_TTL) {
        flags = { ...cachedFlags };
      } else {
        // Fetch global flags from database
        const { data: globalFlags } = await supabaseAdmin
          .from('feature_flags')
          .select('*')
          .is('user_id', null)
          .single();
        
        if (globalFlags) {
          flags = {
            enableLinkedIn: globalFlags.enable_linkedin ?? DEFAULT_FLAGS.enableLinkedIn,
            enableWhatsApp: globalFlags.enable_whatsapp ?? DEFAULT_FLAGS.enableWhatsApp,
            enableAsyncMode: globalFlags.enable_async_mode ?? DEFAULT_FLAGS.enableAsyncMode,
          };
          
          // Update cache
          cachedFlags = { ...flags };
          cacheTimestamp = now;
        }
      }
      
      // Check for user-specific overrides
      if (userId) {
        const { data: userFlags } = await supabaseAdmin
          .from('feature_flags')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (userFlags) {
          if (userFlags.enable_linkedin !== null) {
            flags.enableLinkedIn = userFlags.enable_linkedin;
          }
          if (userFlags.enable_whatsapp !== null) {
            flags.enableWhatsApp = userFlags.enable_whatsapp;
          }
          if (userFlags.enable_async_mode !== null) {
            flags.enableAsyncMode = userFlags.enable_async_mode;
          }
        }
      }
    } catch (error) {
      // Database error, use defaults
      console.warn('Failed to fetch feature flags from database:', error);
    }
  }
  
  // Apply environment variable overrides (highest priority)
  const envFlags = getEnvFlags();
  flags = { ...flags, ...envFlags };
  
  return flags;
}

/**
 * Check if extension sources are enabled
 */
export function isExtensionEnabled(flags: FeatureFlags): boolean {
  return flags.enableLinkedIn || flags.enableWhatsApp;
}

/**
 * Filter analysis based on feature flags
 * Disables LinkedIn/WhatsApp if not enabled in flags
 */
export function filterAnalysisByFlags(
  analysis: {
    needsLinkedIn: boolean;
    needsWhatsApp: boolean;
    linkedInKeywords?: string[] | null | undefined;
    whatsAppKeywords?: string[] | null | undefined;
  },
  flags: FeatureFlags
): {
  needsLinkedIn: boolean;
  needsWhatsApp: boolean;
  linkedInKeywords: string[] | null;
  whatsAppKeywords: string[] | null;
} {
  return {
    needsLinkedIn: flags.enableLinkedIn && analysis.needsLinkedIn,
    needsWhatsApp: flags.enableWhatsApp && analysis.needsWhatsApp,
    linkedInKeywords: flags.enableLinkedIn ? (analysis.linkedInKeywords ?? null) : null,
    whatsAppKeywords: flags.enableWhatsApp ? (analysis.whatsAppKeywords ?? null) : null,
  };
}
