import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.hero}>
        <div className={styles.badge}>
          <span className={styles.badgeIcon}>✦</span>
          Privacy-First
        </div>
        <h1 className={styles.title}>
          Your personal assistant that
          <span className={styles.gradient}> never stores your data</span>
        </h1>
        <p className={styles.description}>
          Search across your emails, calendar, LinkedIn, and WhatsApp messages.
          All processing happens in real-time. Nothing is stored.
        </p>
        <div className={styles.cta}>
          <Link href="/login" className={styles.primaryButton}>
            Get Started
          </Link>
          <Link href="#features" className={styles.secondaryButton}>
            Learn More
          </Link>
        </div>
      </div>

      <div id="features" className={styles.features}>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🔒</div>
          <h3>Zero Storage</h3>
          <p>Your queries and data are processed in-memory only. Nothing is saved to any database.</p>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>📧</div>
          <h3>Gmail & Calendar</h3>
          <p>Search your emails and schedule with natural language questions.</p>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>💬</div>
          <h3>Messages</h3>
          <p>Search LinkedIn and WhatsApp messages through our browser extension.</p>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🤖</div>
          <h3>AI-Powered</h3>
          <p>Get synthesized answers with cited sources, not just search results.</p>
        </div>
      </div>

      <footer className={styles.footer}>
        <p>Built with privacy in mind. Your data stays yours.</p>
      </footer>
    </main>
  );
}
