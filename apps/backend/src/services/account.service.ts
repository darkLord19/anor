import type { Logger } from '@dotor/logger';
import { createUserClient, getAdminClient } from '../lib/supabase/index.js';
import { getFeatureFlags } from '../lib/feature-flags.js';
import { AuthError } from '../lib/errors/index.js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface SessionInfo {
  user: UserProfile;
  accessToken: string;
}

export class AccountService {
  constructor(private readonly logger: Logger) {}

  async getSession(accessToken: string): Promise<SessionInfo> {
    const supabase = createUserClient(accessToken);
    
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      this.logger.warn({ error: error?.message }, 'Failed to get user session');
      throw new AuthError('Failed to get user');
    }

    return {
      user: {
        id: user.id,
        email: user.email ?? '',
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        createdAt: user.created_at,
      },
      accessToken,
    };
  }

  async getProfile(accessToken: string): Promise<UserProfile> {
    const supabase = createUserClient(accessToken);
    
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      this.logger.warn({ error: error?.message }, 'Failed to get user profile');
      throw new AuthError('Failed to get user');
    }

    return {
      id: user.id,
      email: user.email ?? '',
      name: user.user_metadata?.full_name || user.user_metadata?.name || '',
      createdAt: user.created_at,
    };
  }

  async updateProfile(userId: string, name: string): Promise<void> {
    const admin = getAdminClient();

    const { error } = await admin.auth.admin.updateUserById(
      userId,
      { user_metadata: { full_name: name } }
    );

    if (error) {
      this.logger.error({ error: error.message, userId }, 'Failed to update profile');
      throw new Error(error.message);
    }
  }

  async updatePassword(userId: string, password: string): Promise<void> {
    const admin = getAdminClient();

    const { error } = await admin.auth.admin.updateUserById(
      userId,
      { password }
    );

    if (error) {
      this.logger.error({ error: error.message, userId }, 'Failed to update password');
      throw new Error(error.message);
    }
  }

  async deleteAccount(userId: string): Promise<void> {
    const admin = getAdminClient();

    // Delete user data from connections table
    const { error: connectionsError } = await admin
      .from('connections')
      .delete()
      .eq('user_id', userId);

    if (connectionsError) {
      this.logger.error({ error: connectionsError, userId }, 'Failed to delete connections');
      throw new Error('Failed to delete user data');
    }

    // Delete usage events
    await admin
      .from('usage_events')
      .delete()
      .eq('user_id', userId);

    // Delete profile
    await admin
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    // Delete the auth user
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (deleteError) {
      this.logger.error({ error: deleteError, userId }, 'Failed to delete user');
      throw new Error('Failed to delete account');
    }

    this.logger.info({ userId }, 'Account deleted successfully');
  }

  async getFeatureFlags(userId: string) {
    try {
      return await getFeatureFlags(userId);
    } catch (error) {
      this.logger.error({ error, userId }, 'Failed to get feature flags');
      // Return defaults on error
      return {
        enableLinkedIn: false,
        enableWhatsApp: false,
        enableAsyncMode: false,
      };
    }
  }
}
