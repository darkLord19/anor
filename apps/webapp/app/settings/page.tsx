'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getBackendUrl } from '@/lib/config';
import styles from './page.module.css';

interface Connection {
  type: string;
  email: string | null;
  scopes: string[];
  connectedAt: string;
  needsRefresh: boolean;
}

type SettingsSection = 'profile' | 'connected-accounts';

export default function SettingsPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [user, setUser] = useState<any>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Profile form state
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const backendUrl = getBackendUrl();
      
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }
        
        const accessToken = session.access_token;
        
        setUser(session.user);
        setName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || '');
        
        // Fetch connections
        const connectionsResponse = await fetch(`${backendUrl}/connections`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (connectionsResponse.ok) {
          const connectionsData = await connectionsResponse.json();
          setConnections(connectionsData);
        }
      } catch (error) {
        console.error('Failed to check auth:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleUpdateName = async () => {
    setUpdating(true);
    setProfileMessage(null);
    
    try {
      const backendUrl = getBackendUrl();
      
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${backendUrl}/account/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update name');
      }
      
      setProfileMessage({ type: 'success', text: 'Name updated successfully' });
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (error: any) {
      setProfileMessage({ type: 'error', text: error.message || 'Failed to update name' });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      setProfileMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    
    if (newPassword.length < 6) {
      setProfileMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    
    setUpdating(true);
    setProfileMessage(null);
    
    try {
      const backendUrl = getBackendUrl();
      
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${backendUrl}/account/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }
      
      setProfileMessage({ type: 'success', text: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (error: any) {
      setProfileMessage({ type: 'error', text: error.message || 'Failed to update password' });
    } finally {
      setUpdating(false);
    }
  };

  const handleRequestAccountDeletion = async () => {
    setUpdating(true);
    setProfileMessage(null);
    
    try {
      const backendUrl = getBackendUrl();
      
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      // Call backend to request account deletion
      const response = await fetch(`${backendUrl}/account/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to request account deletion');
      }
      
      setProfileMessage({ 
        type: 'success', 
        text: 'Account deleted successfully. Redirecting to login...' 
      });
      setShowDeleteConfirm(false);
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      setProfileMessage({ type: 'error', text: error.message || 'Failed to request account deletion' });
    } finally {
      setUpdating(false);
    }
  };

  const handleConnect = async (type: string) => {
    const backendUrl = getBackendUrl();
    
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${backendUrl}/${type}/auth-url`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }
      
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnect = async (type: string) => {
    const backendUrl = getBackendUrl();
    
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }
      
      const response = await fetch(`${backendUrl}/${type}/disconnect`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const connectionsResponse = await fetch(`${backendUrl}/connections`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });
        
        if (connectionsResponse.ok) {
          const data = await connectionsResponse.json();
          setConnections(data);
        }
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const isGoogleConnected = connections.some(conn => conn.type === 'google');

  if (loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loading}>Loading...</div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>✦</span>
          Dotor
        </div>
        <div className={styles.headerRight}>
          <button 
            onClick={() => router.push('/ask')} 
            className={styles.backButton}
          >
            ← Back
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <nav className={styles.nav}>
            <button
              className={`${styles.navItem} ${activeSection === 'profile' ? styles.navItemActive : ''}`}
              onClick={() => setActiveSection('profile')}
            >
              Profile
            </button>
            <button
              className={`${styles.navItem} ${activeSection === 'connected-accounts' ? styles.navItemActive : ''}`}
              onClick={() => setActiveSection('connected-accounts')}
            >
              Connected Accounts
            </button>
          </nav>
        </aside>

        {/* Main Content */}
        <div className={styles.mainContent}>
          {activeSection === 'profile' && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Profile</h2>
              
              {profileMessage && (
                <div className={`${styles.message} ${styles[`message${profileMessage.type === 'success' ? 'Success' : 'Error'}`]}`}>
                  {profileMessage.text}
                </div>
              )}

              {/* Email (read-only) */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <div className={styles.readOnlyValue}>{user?.email || 'N/A'}</div>
                <p className={styles.helpText}>Email cannot be changed</p>
              </div>

              {/* Name */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={styles.input}
                  placeholder="Enter your name"
                />
                <button
                  onClick={handleUpdateName}
                  disabled={updating || !name}
                  className={styles.updateButton}
                >
                  {updating ? 'Updating...' : 'Update Name'}
                </button>
              </div>

              {/* Password */}
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Enter current password"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Enter new password"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.input}
                  placeholder="Confirm new password"
                />
                <button
                  onClick={handleUpdatePassword}
                  disabled={updating || !newPassword || !confirmPassword}
                  className={styles.updateButton}
                >
                  {updating ? 'Updating...' : 'Update Password'}
                </button>
              </div>

              {/* Account Deletion */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Account Deletion</label>
                <p className={styles.helpText}>
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className={styles.deleteButton}
                  >
                    Request Account Deletion
                  </button>
                ) : (
                  <div className={styles.deleteConfirm}>
                    <p className={styles.deleteWarning}>
                      Are you sure you want to delete your account? This action cannot be undone.
                    </p>
                    <div className={styles.deleteActions}>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className={styles.cancelButton}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRequestAccountDeletion}
                        disabled={updating}
                        className={styles.confirmDeleteButton}
                      >
                        {updating ? 'Processing...' : 'Yes, Delete My Account'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection === 'connected-accounts' && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Connected Accounts</h2>
              
              {/* Google Account */}
              <div className={styles.accountProvider}>
                <div className={styles.providerHeader}>
                  <div className={styles.providerInfo}>
                    <svg className={styles.googleIcon} viewBox="0 0 24 24" width="24" height="24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span className={styles.providerName}>Google</span>
                  </div>
                  {isGoogleConnected ? (
                    <button
                      onClick={() => handleDisconnect('google')}
                      className={styles.disconnectButton}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect('google')}
                      className={styles.connectButton}
                    >
                      Connect
                    </button>
                  )}
                </div>
                {isGoogleConnected && (() => {
                  const googleConn = connections.find(conn => conn.type === 'google');
                  if (!googleConn) return null;
                  
                  const scopeLabels: Record<string, string> = {
                    'gmail.readonly': '📧 Gmail (read-only)',
                    'calendar.readonly': '📅 Calendar (read-only)',
                    'userinfo.email': '👤 Email address',
                  };
                  
                  const displayedScopes = googleConn.scopes
                    .map(scope => {
                      if (scope.includes('gmail')) return scopeLabels['gmail.readonly'];
                      if (scope.includes('calendar')) return scopeLabels['calendar.readonly'];
                      if (scope.includes('userinfo')) return scopeLabels['userinfo.email'];
                      return null;
                    })
                    .filter(Boolean) as string[];
                  
                  return (
                    <div className={styles.connectionDetails}>
                      {googleConn.email && (
                        <div className={styles.connectionEmail}>{googleConn.email}</div>
                      )}
                      <div className={styles.connectionMeta}>
                        <span>Connected {new Date(googleConn.connectedAt).toLocaleDateString()}</span>
                        {googleConn.needsRefresh && (
                          <span className={styles.needsRefresh}>• Needs refresh</span>
                        )}
                      </div>
                      {displayedScopes.length > 0 && (
                        <div className={styles.scopes}>
                          <span className={styles.scopesLabel}>Permissions:</span>
                          <ul className={styles.scopesList}>
                            {displayedScopes.map((label, idx) => (
                              <li key={idx} className={styles.scopeItem}>{label}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
