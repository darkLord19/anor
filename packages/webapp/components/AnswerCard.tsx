'use client';

import { useMemo } from 'react';
import styles from './AnswerCard.module.css';

interface Citation {
  source: string;
  content: string;
  id: string;
  link?: string;
  messageId?: string;
  threadId?: string;
  eventId?: string;
  // Additional metadata for display
  from?: string;
  subject?: string;
  date?: string;
}

interface Answer {
  answer: string;
  citations: Citation[];
  confidence: number;
  insufficient: boolean;
}

interface AnswerCardProps {
  answer: Answer;
}

/**
 * Parse markdown-like text and convert to HTML
 * Supports: **bold**, *italic*, [N] citations (with links), bullet lists, and line breaks
 */
function parseMarkdown(text: string, citations: Citation[]): string {
  // Build a map of citation numbers to their links
  const citationLinks = new Map<number, string>();
  citations.forEach((citation, index) => {
    if (citation.link) {
      citationLinks.set(index + 1, citation.link);
    }
  });

  let html = text
    // Remove "LINK to SOURCE" lines if they exist (safeguard)
    .replace(/-\s*LINK to SOURCE:.*$/gim, '')
    .replace(/LINK to SOURCE:.*$/gim, '')
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold: **text**
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic: *text*
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Citation links: [N] - make clickable if we have a link
    .replace(/\[(\d+)\]/g, (_match, num) => {
      const citationNum = parseInt(num, 10);
      const link = citationLinks.get(citationNum);
      if (link) {
        return `<a href="${link}" target="_blank" rel="noopener noreferrer" class="citation-link">[${num}]</a>`;
      }
      return `<span class="citation">[${num}]</span>`;
    })
    // Line breaks
    .replace(/\n/g, '<br />');
  
  // Handle bullet points: lines starting with "- "
  const lines = html.split('<br />');
  let inList = false;
  const processedLines: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('- ')) {
      if (!inList) {
        processedLines.push('<ul>');
        inList = true;
      }
      processedLines.push(`<li>${trimmedLine.slice(2)}</li>`);
    } else {
      if (inList) {
        processedLines.push('</ul>');
        inList = false;
      }
      processedLines.push(line);
    }
  }
  
  if (inList) {
    processedLines.push('</ul>');
  }
  
  return processedLines.join('');
}

export function AnswerCard({ answer }: AnswerCardProps) {
  const formattedAnswer = useMemo(
    () => parseMarkdown(answer.answer, answer.citations), 
    [answer.answer, answer.citations]
  );

  if (answer.insufficient) {
    return (
      <div className={`${styles.card} ${styles.insufficient}`}>
        <div className={styles.insufficientIcon}>🔍</div>
        <p className={styles.insufficientText}>
          {answer.answer}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.content}>
        <div 
          className={styles.answer}
          dangerouslySetInnerHTML={{ __html: formattedAnswer }}
        />
      </div>
    </div>
  );
}

