'use client';

import styles from './ExtensionStatus.module.css';

interface ExtensionStatusProps {
  connected: boolean;
}

export function ExtensionStatus({ connected }: ExtensionStatusProps) {
  return (
    <div className={`${styles.container} ${connected ? styles.connected : styles.disconnected}`}>
      <span className={styles.indicator} />
      <span className={styles.label}>
        {connected ? 'Extension connected' : 'Extension not connected'}
      </span>
    </div>
  );
}

