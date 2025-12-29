import type { SearchHit } from '../types/search.js';

/**
 * Deterministic confidence scoring formula
 * Based on:
 * - Number of sources (more = higher confidence)
 * - Source diversity (different types = higher confidence)
 * - Result relevance scores
 */
export function calculateConfidence(results: SearchHit[]): number {
  if (results.length === 0) return 0;

  // Base score from result count (max 40 points)
  const countScore = Math.min(results.length * 5, 40);

  // Diversity score (max 30 points)
  const sources = new Set(results.map(r => r.source));
  const diversityScore = sources.size * 10;

  // Average relevance score (max 30 points)
  const avgRelevance = results.reduce((sum, r) => sum + r.relevance, 0) / results.length;
  const relevanceScore = avgRelevance * 30;

  // Calculate total (capped at 100)
  const total = Math.round(countScore + diversityScore + relevanceScore);
  return Math.min(Math.max(total, 0), 100);
}

/**
 * Get confidence level label
 */
export function getConfidenceLevel(score: number): 'high' | 'medium' | 'low' | 'insufficient' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'low';
  return 'insufficient';
}

/**
 * Calculate source breakdown
 */
export function getSourceBreakdown(results: SearchHit[]): Record<string, number> {
  const breakdown: Record<string, number> = {};
  
  for (const result of results) {
    breakdown[result.source] = (breakdown[result.source] ?? 0) + 1;
  }
  
  return breakdown;
}

