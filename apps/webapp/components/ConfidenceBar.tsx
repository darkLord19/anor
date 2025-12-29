'use client';

import styles from './ConfidenceBar.module.css';

interface ConfidenceBarProps {
  confidence: number;
}

export function ConfidenceBar({ confidence }: ConfidenceBarProps) {
  const getLevel = () => {
    if (confidence >= 70) return { label: 'High confidence', class: styles.high };
    if (confidence >= 40) return { label: 'Medium confidence', class: styles.medium };
    if (confidence >= 20) return { label: 'Low confidence', class: styles.low };
    return { label: 'Insufficient data', class: styles.insufficient };
  };

  const level = getLevel();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={`${styles.label} ${level.class}`}>
          {level.label}
        </span>
        <span className={styles.percentage}>{confidence}%</span>
      </div>
      <div className={styles.track}>
        <div 
          className={`${styles.fill} ${level.class}`}
          style={{ width: `${confidence}%` }}
        />
      </div>
    </div>
  );
}

