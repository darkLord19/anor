'use client';

import { useState } from 'react';
import styles from './SourceBadges.module.css';

interface Citation {
  source: string;
  content: string;
  id: string;
  link?: string;
  messageId?: string;
  threadId?: string;
  eventId?: string;
  from?: string;
  subject?: string;
  date?: string;
}

interface SourceBadgesProps {
  citations: Citation[];
}

const sourceIcons: Record<string, string> = {
  gmail: '📧',
  calendar: '📅',
  linkedin: '💼',
  whatsapp: '💬',
};

/**
 * Extract sender name from email "Name <email@example.com>" format
 */
function extractSenderName(from: string): string {
  if (!from) return 'Unknown';
  const match = from.match(/^([^<]+)</);
  if (match && match[1]) {
    return match[1].trim();
  }
  return from.split('@')[0] || from;
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function SourceBadges({ citations }: SourceBadgesProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Filter citations that have links or can be linked
  const validCitations = citations.filter(c => c.link || (c.source === 'gmail' && c.id));
  
  if (validCitations.length === 0 && citations.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <button 
        className={styles.headerButton} 
        onClick={() => setIsCollapsed(!isCollapsed)}
        type="button"
      >
        <h4 className={styles.title}>Sources ({validCitations.length})</h4>
        <span className={`${styles.chevron} ${isCollapsed ? styles.collapsed : ''}`}>
          ▼
        </span>
      </button>
      
      {!isCollapsed && (
        <div className={styles.sourcesList}>
          {validCitations.length > 0 ? (
            validCitations.map((citation, index) => {
              const link = citation.link || (citation.source === 'gmail' && citation.id ? `https://mail.google.com/mail/u/0/#inbox/${citation.id}` : '#');
              
              return (
              <a
                key={citation.id || index}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sourceCard}
                onClick={(e) => {
                  if (link === '#') e.preventDefault();
                }}
              >
              <div className={styles.sourceCardHeader}>
                <span className={styles.sourceIcon}>{sourceIcons[citation.source] ?? '📄'}</span>
                <span className={styles.sourceNumber}>[{index + 1}]</span>
              </div>
              
              {citation.source === 'gmail' && (
                <div className={styles.emailPreview}>
                  {citation.from ? (
                    <div className={styles.emailField}>
                      <span className={styles.emailLabel}>From:</span>
                      <span className={styles.emailValue}>{extractSenderName(citation.from)}</span>
                    </div>
                  ) : (
                    <div className={styles.emailField}>
                      <span className={styles.emailLabel}>Content:</span>
                      <span className={styles.emailValue}>{truncate(citation.content, 60)}</span>
                    </div>
                  )}
                  {citation.subject && (
                    <div className={styles.emailField}>
                      <span className={styles.emailLabel}>Subject:</span>
                      <span className={styles.emailValue}>{truncate(citation.subject, 50)}</span>
                    </div>
                  )}
                  {citation.content && citation.from && (
                    <div className={styles.emailBody}>
                      {truncate(citation.content, 120)}
                    </div>
                  )}
                </div>
              )}
              
              {citation.source === 'calendar' && (
                <div className={styles.calendarPreview}>
                  <div className={styles.calendarTitle}>{truncate(citation.content, 60)}</div>
                  {citation.date && (
                    <div className={styles.calendarDate}>{citation.date}</div>
                  )}
                </div>
              )}
              
              {(citation.source === 'linkedin' || citation.source === 'whatsapp') && (
                <div className={styles.messagePreview}>
                  {truncate(citation.content, 120)}
                </div>
              )}
              
              <div className={styles.openLink}>
                Open {citation.source === 'gmail' ? 'in Gmail' : citation.source === 'calendar' ? 'in Calendar' : ''} →
              </div>
            </a>
            );
          })
          ) : (
            <div className={styles.noLinks}>
              No direct links available for these sources.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

