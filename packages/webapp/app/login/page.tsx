'use client';

import { useState, useTransition } from 'react';
import styles from './page.module.css';
import { signup, loginWithMagicLink } from './actions';

type AuthMode = 'login' | 'signup' | 'magic';

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();


  // Handle signup form submission
  const handleSignup = async (formData: FormData) => {
    setMessage('');
    setIsError(false);
    
    startTransition(async () => {
      const result = await signup(formData);
      
      if (result?.error) {
        setMessage(result.error);
        setIsError(true);
      } else if (result?.success) {
        setMessage(result.success);
        setIsError(false);
      }
    });
  };

  const handleMagicLink = async (formData: FormData) => {
    setMessage('');
    setIsError(false);
    
    startTransition(async () => {
      const result = await loginWithMagicLink(formData);
      
      if (result?.error) {
        setMessage(result.error);
        setIsError(true);
      } else if (result?.success) {
        setMessage(result.success);
        setIsError(false);
      }
    });
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>✦</span>
          Dotor
        </div>
        <h1 className={styles.title}>
          {mode === 'signup' ? 'Create account' : 'Welcome back'}
        </h1>
        <p className={styles.subtitle}>
          {mode === 'signup' 
            ? 'Sign up to get started' 
            : 'Sign in to access your personal assistant'}
        </p>

        {mode === 'magic' ? (
          <form action={handleMagicLink} className={styles.form}>
            <input
              type="email"
              name="email"
              placeholder="Enter your email"
              className={styles.input}
              disabled={isPending}
              required
            />
            <button
              type="submit"
              disabled={isPending}
              className={styles.primaryButton}
            >
              {isPending ? 'Sending...' : 'Send Magic Link'}
            </button>
          </form>
        ) : (
          <form 
            action={mode === 'login' ? '/api/login' : handleSignup}
            {...(mode === 'login' ? { method: 'POST' } : {})}
            className={styles.form}
          >
            <input
              type="email"
              name="email"
              placeholder="Email"
              className={styles.input}
              disabled={isPending}
              autoComplete="email"
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              className={styles.input}
              disabled={isPending}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
            />
            <button
              type="submit"
              disabled={isPending}
              className={styles.primaryButton}
            >
              {isPending ? 'Loading...' : mode === 'signup' ? 'Sign up' : 'Sign in'}
            </button>
          </form>
        )}

        {message && (
          <p className={`${styles.message} ${isError ? styles.error : ''}`}>
            {message}
          </p>
        )}

        <div className={styles.authToggle}>
          {mode === 'login' && (
            <>
              <button 
                onClick={() => { setMode('signup'); setMessage(''); }}
                className={styles.linkButton}
              >
                Don&apos;t have an account? Sign up
              </button>
              <button 
                onClick={() => { setMode('magic'); setMessage(''); }}
                className={styles.linkButton}
              >
                Use magic link instead
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button 
              onClick={() => { setMode('login'); setMessage(''); }}
              className={styles.linkButton}
            >
              Already have an account? Sign in
            </button>
          )}
          {mode === 'magic' && (
            <button 
              onClick={() => { setMode('login'); setMessage(''); }}
              className={styles.linkButton}
            >
              Use password instead
            </button>
          )}
        </div>

        <p className={styles.privacy}>
          🔒 Your data is never stored. Privacy-first.
        </p>
      </div>
    </main>
  );
}
